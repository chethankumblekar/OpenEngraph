import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import { QueryRouter } from '../../src/query/router.js';

function seed(db: ReturnType<typeof openDatabase>) {
  db.prepare('INSERT INTO nodes VALUES (?, ?, ?, ?, ?, ?)').run('n1', 'function', 'rateLimit', 'a.ts', 1, 5);
  db.prepare('INSERT INTO nodes VALUES (?, ?, ?, ?, ?, ?)').run('n2', 'function', 'handleRequest', 'a.ts', 7, 12);
  db.prepare('INSERT INTO edges (source_id, target_id, kind) VALUES (?, ?, ?)').run('n2', 'n1', 'REFERENCES');
}

describe('QueryRouter', () => {
  it('structuralQuery returns directly connected nodes without touching embeddings', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    seed(db);
    const router = new QueryRouter(db);
    const results = router.structuralQuery('n2', 'REFERENCES');
    expect(results).toEqual([expect.objectContaining({ id: 'n1', via: 'graph' })]);
  });

  it('structuralQuery returns empty array for a node with no matching edges', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    seed(db);
    const router = new QueryRouter(db);
    expect(router.structuralQuery('n1', 'REFERENCES')).toEqual([]);
  });
});
