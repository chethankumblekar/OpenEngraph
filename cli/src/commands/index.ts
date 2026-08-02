import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { applySchema } from '@openengraph/core/storage/schema.js';
import { detectChangedFiles } from '@openengraph/core/index/changeDetector.js';
import { loadPlugin } from '@openengraph/core/plugins/loader.js';
import { buildGraph } from '@openengraph/core/graph/builder.js';
import { indexNodeChunks } from '@openengraph/core/embeddings/index.js';

export async function runIndex(repoPath: string, pluginDirs: string[]): Promise<{ filesIndexed: number }> {
  mkdirSync(join(repoPath, '.openengraph'), { recursive: true });
  const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
  applySchema(db);

  // pluginDirs are always absolute — do not join with repoPath, which is the
  // *indexed* repo, an unrelated directory from wherever plugins are installed.
  const plugins = await Promise.all(pluginDirs.map((dir) => loadPlugin(dir)));
  const { changed } = detectChangedFiles(repoPath, db);

  let filesIndexed = 0;
  for (const file of changed) {
    const plugin = plugins.find((p) => p.manifest.extensions.some((ext) => file.endsWith(ext)));
    if (!plugin) continue;
    const source = readFileSync(join(repoPath, file), 'utf8');
    await buildGraph(db, file, source, plugin);
    await indexNodeChunks(db, file, source.split('\n'));
    filesIndexed++;
  }

  db.close();
  return { filesIndexed };
}
