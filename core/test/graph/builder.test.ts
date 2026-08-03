import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import { buildGraph, removeFileFromGraph } from '../../src/graph/builder.js';
import type { ExtractedEntity, LanguagePlugin } from '../../src/plugins/types.js';

const fakePlugin: LanguagePlugin = {
  manifest: { name: 'fake', language: 'fake', extensions: ['.fk'], grammar: 'none' },
  async extract() {
    return [
      { kind: 'function', name: 'greet', startLine: 1, endLine: 3 },
      { kind: 'import', name: 'node:fs', startLine: 0, endLine: 0 }
    ];
  }
};

/** A plugin that returns whatever entities the test hands it. */
function pluginReturning(entities: ExtractedEntity[]): LanguagePlugin {
  return {
    manifest: { name: 'fake', language: 'fake', extensions: ['.fk'], grammar: 'none' },
    async extract() {
      return entities;
    }
  };
}

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

  it('creates a REFERENCES edge between two same-file entities', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(
      db,
      'greet.ts',
      'source',
      pluginReturning([
        { kind: 'function', name: 'greet', startLine: 1, endLine: 3 },
        { kind: 'function', name: 'welcome', startLine: 5, endLine: 7, references: ['greet'] }
      ])
    );

    const edges = db
      .prepare('SELECT source_id, target_id, kind FROM edges')
      .all() as { source_id: string; target_id: string; kind: string }[];
    expect(edges).toEqual([
      {
        source_id: 'greet.ts:function:welcome:5',
        target_id: 'greet.ts:function:greet:1',
        kind: 'REFERENCES'
      }
    ]);
  });

  it('ignores references that resolve to nothing, to itself, or to a duplicate', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(
      db,
      'greet.ts',
      'source',
      pluginReturning([
        { kind: 'function', name: 'greet', startLine: 1, endLine: 3 },
        {
          kind: 'function',
          name: 'welcome',
          startLine: 5,
          endLine: 7,
          references: ['greet', 'greet', 'welcome', 'definedInAnotherFile']
        }
      ])
    );
    expect(db.prepare('SELECT COUNT(*) AS n FROM edges').get()).toEqual({ n: 1 });
  });

  it('re-indexes an edited file that already has edges and chunks', async () => {
    // Regression: `nodes` has dependent `edges`/`chunks` rows, and better-sqlite3
    // enables PRAGMA foreign_keys by default, so deleting a file's nodes used to
    // fail with "FOREIGN KEY constraint failed" on every re-index after the first.
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(
      db,
      'greet.ts',
      'source',
      pluginReturning([
        { kind: 'function', name: 'greet', startLine: 1, endLine: 3 },
        { kind: 'function', name: 'welcome', startLine: 5, endLine: 7, references: ['greet'] }
      ])
    );
    for (const { id } of db.prepare('SELECT id FROM nodes').all() as { id: string }[]) {
      db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
        `chunk:${id}`,
        id,
        'stale text',
        Buffer.from(new Float32Array([1, 0, 0]).buffer)
      );
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM edges').get()).toEqual({ n: 1 });

    // The file is edited: `greet` moves down, `welcome` is gone.
    await buildGraph(
      db,
      'greet.ts',
      'edited source',
      pluginReturning([{ kind: 'function', name: 'greet', startLine: 10, endLine: 14 }])
    );

    const nodes = db.prepare('SELECT id, start_line, end_line FROM nodes').all();
    expect(nodes).toEqual([{ id: 'greet.ts:function:greet:10', start_line: 10, end_line: 14 }]);
    // Edges and chunks pointing at the removed nodes are gone with them.
    expect(db.prepare('SELECT COUNT(*) AS n FROM edges').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM chunks').get()).toEqual({ n: 0 });
  });
});

describe('removeFileFromGraph', () => {
  it('drops the file\'s nodes along with its edges and chunks', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(
      db,
      'greet.ts',
      'source',
      pluginReturning([
        { kind: 'function', name: 'greet', startLine: 1, endLine: 3 },
        { kind: 'function', name: 'welcome', startLine: 5, endLine: 7, references: ['greet'] }
      ])
    );
    db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
      'chunk:1',
      'greet.ts:function:greet:1',
      'text',
      null
    );
    await buildGraph(
      db,
      'other.ts',
      'source',
      pluginReturning([{ kind: 'function', name: 'other', startLine: 1, endLine: 2 }])
    );

    removeFileFromGraph(db, 'greet.ts');

    expect(db.prepare('SELECT id FROM nodes').all()).toEqual([{ id: 'other.ts:function:other:1' }]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM edges').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM chunks').get()).toEqual({ n: 0 });
  });
});
