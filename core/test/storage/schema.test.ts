import { describe, it, expect, afterAll } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';

describe('applySchema', () => {
  const db = openDatabase(':memory:');
  afterAll(() => db.close());

  it('creates nodes, edges, chunks, and files tables', () => {
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual(expect.arrayContaining(['nodes', 'edges', 'chunks', 'files']));
  });

  it('is idempotent when applied twice', () => {
    expect(() => {
      applySchema(db);
      applySchema(db);
    }).not.toThrow();
  });
});
