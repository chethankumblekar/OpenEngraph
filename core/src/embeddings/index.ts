import { env, pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import type Database from 'better-sqlite3';
import * as os from 'node:os';
import * as path from 'node:path';

// Machine-global cache (not repo- or node_modules-scoped): embedText() takes
// no repoPath, is shared core infrastructure used across any repo indexed on
// this machine, and must survive `rm -rf node_modules`, fresh checkouts, and
// Docker rebuilds without re-downloading the model each time.
env.cacheDir = path.join(os.homedir(), '.openengraph', 'models');

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return output.data as Float32Array;
}

export async function indexNodeChunks(
  db: Database.Database,
  filePath: string,
  sourceLines: string[]
): Promise<void> {
  const nodes = db.prepare('SELECT id, start_line, end_line FROM nodes WHERE file = ?').all(filePath) as {
    id: string;
    start_line: number;
    end_line: number;
  }[];

  const upsert = db.prepare(
    'INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text, embedding = excluded.embedding'
  );

  for (const node of nodes) {
    const text = sourceLines.slice(node.start_line - 1, node.end_line).join('\n');
    const vector = await embedText(text);
    upsert.run(`chunk:${node.id}`, node.id, text, Buffer.from(vector.buffer));
  }
}
