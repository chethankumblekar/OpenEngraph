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
});
