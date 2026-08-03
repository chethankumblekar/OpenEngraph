import type Database from 'better-sqlite3';
import type { LanguagePlugin } from '../plugins/types.js';

/**
 * Removes every graph row belonging to `filePath`: its `nodes`, plus the
 * `edges` and `chunks` that hang off those nodes.
 *
 * The schema declares `ON DELETE CASCADE` on both dependent tables, so the
 * explicit child deletes below are technically redundant for databases created
 * after that was added — but `applySchema` uses `CREATE TABLE IF NOT EXISTS`
 * and therefore cannot retrofit the constraint onto a `graph.db` that was
 * created before it. Deleting children explicitly keeps re-indexing working on
 * those older files instead of failing with a FOREIGN KEY constraint error.
 */
export function removeFileFromGraph(db: Database.Database, filePath: string): void {
  const nodeIdsForFile = 'SELECT id FROM nodes WHERE file = ?';
  db.prepare(`DELETE FROM chunks WHERE node_id IN (${nodeIdsForFile})`).run(filePath);
  db.prepare(
    `DELETE FROM edges WHERE source_id IN (${nodeIdsForFile}) OR target_id IN (${nodeIdsForFile})`
  ).run(filePath, filePath);
  db.prepare('DELETE FROM nodes WHERE file = ?').run(filePath);
}

export async function buildGraph(
  db: Database.Database,
  filePath: string,
  sourceCode: string,
  plugin: LanguagePlugin
): Promise<void> {
  const entities = await plugin.extract(sourceCode, filePath);

  const insertNode = db.prepare(
    'INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertEdge = db.prepare('INSERT INTO edges (source_id, target_id, kind) VALUES (?, ?, ?)');

  const tx = db.transaction(() => {
    removeFileFromGraph(db, filePath);

    const idByName = new Map<string, string>();
    const idByEntity: string[] = [];

    for (const entity of entities) {
      const id = `${filePath}:${entity.kind}:${entity.name}:${entity.startLine}`;
      insertNode.run(id, entity.kind, entity.name, filePath, entity.startLine, entity.endLine);
      idByEntity.push(id);
      idByName.set(entity.name, id);
    }

    // Same-file reference linking only for Phase 1. Cross-file/cross-repo
    // resolution is enterprise-roadmap scope (design doc Section 6).
    entities.forEach((entity, i) => {
      const sourceId = idByEntity[i];
      if (!entity.references) return;
      const linked = new Set<string>();
      for (const ref of entity.references) {
        const targetId = idByName.get(ref);
        // Skip unresolvable names (defined in another file) and self-loops,
        // which carry no information for one-hop structural expansion.
        if (!targetId || targetId === sourceId || linked.has(targetId)) continue;
        linked.add(targetId);
        insertEdge.run(sourceId, targetId, 'REFERENCES');
      }
    });
  });
  tx();
}
