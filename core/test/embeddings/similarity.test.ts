import { describe, it, expect } from 'vitest';
import { cosineSimilarity, searchSimilar } from '../../src/embeddings/similarity.js';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0);
  });
});

describe('searchSimilar', () => {
  function toBlob(values: number[]): Buffer {
    return Buffer.from(new Float32Array(values).buffer);
  }

  it('ranks chunks by cosine similarity to the query vector', () => {
    const db = openDatabase(':memory:');
    applySchema(db);

    db.prepare('INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)').run(
      'n1', 'function', 'a', 'a.ts', 1, 1
    );
    db.prepare('INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)').run(
      'n2', 'function', 'b', 'b.ts', 1, 1
    );
    db.prepare('INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)').run(
      'n3', 'function', 'c', 'c.ts', 1, 1
    );

    // n1: identical to query -> similarity 1
    // n2: orthogonal to query -> similarity 0
    // n3: opposite of query -> similarity -1
    db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
      'c1', 'n1', 'exact match', toBlob([1, 0, 0])
    );
    db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
      'c2', 'n2', 'orthogonal', toBlob([0, 1, 0])
    );
    db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
      'c3', 'n3', 'opposite', toBlob([-1, 0, 0])
    );

    const results = searchSimilar(db, new Float32Array([1, 0, 0]), 3);

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.nodeId)).toEqual(['n1', 'n2', 'n3']);
    expect(results[0].score).toBeCloseTo(1);
    expect(results[1].score).toBeCloseTo(0);
    expect(results[2].score).toBeCloseTo(-1);
  });

  it('respects topK and excludes rows with no embedding', () => {
    const db = openDatabase(':memory:');
    applySchema(db);

    db.prepare('INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)').run(
      'n1', 'function', 'a', 'a.ts', 1, 1
    );
    db.prepare('INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)').run(
      'n2', 'function', 'b', 'b.ts', 1, 1
    );

    db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
      'c1', 'n1', 'has embedding', toBlob([1, 0, 0])
    );
    db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, NULL)').run(
      'c2', 'n2', 'no embedding'
    );

    const results = searchSimilar(db, new Float32Array([1, 0, 0]), 1);

    expect(results).toHaveLength(1);
    expect(results[0].nodeId).toBe('n1');
  });

  it('returns the same topK winners for tied scores regardless of row insertion/deletion history', () => {
    // Reproduces GitHub issue #3: incremental re-indexing can disagree with a
    // full clean re-index for the same tree. Root cause: `SELECT ... FROM
    // chunks` below has no ORDER BY, so SQLite's row order is whatever the
    // table's physical/rowid layout happens to be; ties are then broken by
    // Array.prototype.sort's stability, i.e. by that incidental row order.
    // Real-world equivalent: multiple files sharing an identical line (e.g.
    // the same `import` statement) embed to byte-identical vectors, so their
    // cosine similarity against any query ties exactly.
    const db = openDatabase(':memory:');
    applySchema(db);

    const tie = toBlob([1, 0, 0]);
    for (const id of ['n1', 'n2', 'n3', 'n4']) {
      db.prepare('INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)').run(
        id, 'function', id, `${id}.ts`, 1, 1
      );
      db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
        `c-${id}`, id, 'same text everywhere', tie
      );
    }

    const fullBuildWinners = searchSimilar(db, new Float32Array([1, 0, 0]), 2)
      .map((r) => r.nodeId)
      .sort();

    // Simulate an incremental re-index of n1's file: its chunk row is
    // deleted and re-inserted (same content, same score, new physical
    // position) — exactly what `removeFileFromGraph` + `buildGraph` do to a
    // single changed file, leaving the other three files' rows untouched.
    db.prepare('DELETE FROM chunks WHERE id = ?').run('c-n1');
    db.prepare('INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?)').run(
      'c-n1', 'n1', 'same text everywhere', tie
    );

    const incrementalWinners = searchSimilar(db, new Float32Array([1, 0, 0]), 2)
      .map((r) => r.nodeId)
      .sort();

    expect(incrementalWinners).toEqual(fullBuildWinners);
  });
});
