import type Database from 'better-sqlite3';
import type { LanguagePlugin } from '../plugins/types.js';

export async function buildGraph(
  db: Database.Database,
  filePath: string,
  sourceCode: string,
  plugin: LanguagePlugin
): Promise<void> {
  const entities = await plugin.extract(sourceCode, filePath);

  const deleteExisting = db.prepare('DELETE FROM nodes WHERE file = ?');
  const insertNode = db.prepare(
    'INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertEdge = db.prepare('INSERT INTO edges (source_id, target_id, kind) VALUES (?, ?, ?)');

  const tx = db.transaction(() => {
    deleteExisting.run(filePath);
    const idByName = new Map<string, string>();

    for (const entity of entities) {
      const id = `${filePath}:${entity.kind}:${entity.name}:${entity.startLine}`;
      insertNode.run(id, entity.kind, entity.name, filePath, entity.startLine, entity.endLine);
      idByName.set(entity.name, id);
    }

    // Same-file reference linking only for Phase 1. Cross-file/cross-repo
    // resolution is enterprise-roadmap scope (design doc Section 6).
    for (const entity of entities) {
      const sourceId = idByName.get(entity.name);
      if (!sourceId || !entity.references) continue;
      for (const ref of entity.references) {
        const targetId = idByName.get(ref);
        if (targetId) insertEdge.run(sourceId, targetId, 'REFERENCES');
      }
    }
  });
  tx();
}
