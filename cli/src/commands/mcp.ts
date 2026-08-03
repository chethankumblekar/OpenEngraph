import { join } from 'node:path';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { startStdioServer } from '@openengraph/server';

export async function runMcp(repoPath: string): Promise<void> {
  const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
  await startStdioServer(db);
}
