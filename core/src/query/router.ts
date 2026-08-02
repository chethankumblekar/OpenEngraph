import type Database from 'better-sqlite3';
import { embedText } from '../embeddings/index.js';
import { searchSimilar } from '../embeddings/similarity.js';
import type { GraphResult } from './types.js';

export class QueryRouter {
  constructor(private db: Database.Database) {}

  structuralQuery(nodeId: string, edgeKind?: string): GraphResult[] {
    const sql = edgeKind
      ? 'SELECT n.* FROM edges e JOIN nodes n ON n.id = e.target_id WHERE e.source_id = ? AND e.kind = ?'
      : 'SELECT n.* FROM edges e JOIN nodes n ON n.id = e.target_id WHERE e.source_id = ?';
    const rows = edgeKind
      ? (this.db.prepare(sql).all(nodeId, edgeKind) as any[])
      : (this.db.prepare(sql).all(nodeId) as any[]);
    return rows.map((row) => this.toResult(row, 'graph'));
  }

  async semanticQuery(text: string, topK = 5): Promise<GraphResult[]> {
    const vector = await embedText(text);
    const matches = searchSimilar(this.db, vector, topK);
    return matches
      .map((m) => this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(m.nodeId) as any)
      .filter(Boolean)
      .map((row) => this.toResult(row, 'embedding'));
  }

  async hybridQuery(text: string, topK = 5): Promise<GraphResult[]> {
    const seeds = await this.semanticQuery(text, topK);
    const seen = new Map(seeds.map((s) => [s.id, s]));
    for (const seed of seeds) {
      for (const expanded of this.structuralQuery(seed.id)) {
        if (!seen.has(expanded.id)) seen.set(expanded.id, expanded);
      }
    }
    return [...seen.values()];
  }

  private toResult(row: any, via: 'graph' | 'embedding'): GraphResult {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      file: row.file,
      startLine: row.start_line,
      endLine: row.end_line,
      via
    };
  }
}
