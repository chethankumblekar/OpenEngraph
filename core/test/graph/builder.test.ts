import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import { buildGraph } from '../../src/graph/builder.js';
import type { LanguagePlugin } from '../../src/plugins/types.js';

const fakePlugin: LanguagePlugin = {
  manifest: { name: 'fake', language: 'fake', extensions: ['.fk'], grammar: 'none' },
  async extract() {
    return [
      { kind: 'function', name: 'greet', startLine: 1, endLine: 3 },
      { kind: 'import', name: 'node:fs', startLine: 0, endLine: 0 }
    ];
  }
};

describe('buildGraph', () => {
  it('inserts one node per extracted entity', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(db, 'greet.ts', 'source', fakePlugin);
    const nodes = db.prepare('SELECT * FROM nodes').all();
    expect(nodes).toHaveLength(2);
  });

  it('is idempotent when the same file is rebuilt', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(db, 'greet.ts', 'source', fakePlugin);
    await buildGraph(db, 'greet.ts', 'source', fakePlugin);
    const nodes = db.prepare('SELECT * FROM nodes').all();
    expect(nodes).toHaveLength(2);
  });
});
