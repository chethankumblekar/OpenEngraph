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

  // Break ties by nodeId, not by incidental row order. `chunks` has no
  // meaningful ORDER BY here, so two chunks with byte-identical text (e.g.
  // the same `import` line repeated across files) can tie exactly on score;
  // without a deterministic secondary key, Array.prototype.sort's stability
  // just preserves whatever physical order SQLite happened to return the
  // rows in — which shifts every time a file is incrementally re-indexed
  // (delete + reinsert changes that row's position) even though its content
  // and score never changed. That made topK's cutoff, and therefore
  // structural/hybrid query results, depend on indexing history instead of
  // repository content (issue #3).
  scored.sort((a, b) => b.score - a.score || (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));
  return scored.slice(0, topK);
}
