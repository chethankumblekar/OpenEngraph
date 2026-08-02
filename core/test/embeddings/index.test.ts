import { describe, it, expect } from 'vitest';
import { embedText, indexNodeChunks } from '../../src/embeddings/index.js';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';

describe('embedText', () => {
  it('returns a 384-dimension normalized vector', async () => {
    const vec = await embedText('function that adds two numbers');
    expect(vec.length).toBe(384);
    const magnitude = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
    expect(magnitude).toBeCloseTo(1, 1);
  }, 30_000); // first call downloads model weights
});

describe('indexNodeChunks', () => {
  it('embeds and stores a chunk sliced from the source lines', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);

    db.prepare('INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)').run(
      'node:add', 'function', 'add', 'add.ts', 1, 3
    );

    const sourceLines = [
      'function add(a: number, b: number): number {',
      '  return a + b;',
      '}'
    ];

    await indexNodeChunks(db, 'add.ts', sourceLines);

    const chunk = db.prepare('SELECT * FROM chunks WHERE node_id = ?').get('node:add') as {
      id: string;
      node_id: string;
      text: string;
      embedding: Buffer | null;
    };

    expect(chunk).toBeDefined();
    expect(chunk.id).toBe('chunk:node:add');
    expect(chunk.text).toBe(sourceLines.join('\n'));
    expect(chunk.embedding).not.toBeNull();

    const vector = new Float32Array(
      chunk.embedding!.buffer,
      chunk.embedding!.byteOffset,
      chunk.embedding!.length / 4
    );
    expect(vector.length).toBe(384);
  }, 30_000); // may trigger model download if not already cached
});
