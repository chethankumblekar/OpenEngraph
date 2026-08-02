import type Database from 'better-sqlite3';

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchSimilar(
  db: Database.Database,
  queryVector: Float32Array,
  topK: number
): { nodeId: string; score: number }[] {
  const rows = db.prepare('SELECT node_id, embedding FROM chunks WHERE embedding IS NOT NULL').all() as {
    node_id: string;
    embedding: Buffer;
  }[];

  const scored = rows.map((row) => ({
    nodeId: row.node_id,
    score: cosineSimilarity(queryVector, new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.length / 4))
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
