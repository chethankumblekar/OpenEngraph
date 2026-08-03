import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { applySchema } from '@openengraph/core/storage/schema.js';
import {
  detectChangedFiles,
  recordIndexedFile,
  forgetIndexedFile
} from '@openengraph/core/index/changeDetector.js';
import { loadPlugin } from '@openengraph/core/plugins/loader.js';
import { buildGraph, removeFileFromGraph } from '@openengraph/core/graph/builder.js';
import { indexNodeChunks } from '@openengraph/core/embeddings/index.js';

export interface IndexResult {
  filesIndexed: number;
  filesRemoved: number;
}

export async function runIndex(repoPath: string, pluginDirs: string[]): Promise<IndexResult> {
  const dataDir = join(repoPath, '.openengraph');
  mkdirSync(dataDir, { recursive: true });

  // Keep the index out of the indexed repo's own git history. Without this,
  // a later `git add -A` in that repo tracks graph.db, and the next run sees
  // its own database as a source file to index.
  writeFileSync(join(dataDir, '.gitignore'), '*\n');

  const db = openDatabase(join(dataDir, 'graph.db'));
  try {
    applySchema(db);

    // pluginDirs are always absolute — do not join with repoPath, which is the
    // *indexed* repo, an unrelated directory from wherever plugins are installed.
    const plugins = await Promise.all(pluginDirs.map((dir) => loadPlugin(dir)));
    const { changed, deleted, hashes } = detectChangedFiles(repoPath, db);

    let filesRemoved = 0;
    for (const file of deleted) {
      removeFileFromGraph(db, file);
      forgetIndexedFile(db, file);
      filesRemoved++;
    }

    let filesIndexed = 0;
    for (const file of changed) {
      const hash = hashes.get(file);
      const plugin = plugins.find((p) => p.manifest.extensions.some((ext) => file.endsWith(ext)));
      if (!plugin) {
        // No plugin handles this extension; there is nothing to index, so the
        // file is trivially up to date at this hash.
        if (hash) recordIndexedFile(db, file, hash);
        continue;
      }
      const source = readFileSync(join(repoPath, file), 'utf8');
      await buildGraph(db, file, source, plugin);
      await indexNodeChunks(db, file, source.split('\n'));
      // Only now, with graph + embedding rows actually written, is it safe to
      // record this hash as indexed.
      if (hash) recordIndexedFile(db, file, hash);
      filesIndexed++;
    }

    return { filesIndexed, filesRemoved };
  } finally {
    db.close();
  }
}
