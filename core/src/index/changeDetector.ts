import { execFileSync } from 'node:child_process';
import type Database from 'better-sqlite3';

export function detectChangedFiles(
  repoPath: string,
  db: Database.Database
): { changed: string[]; deleted: string[] } {
  const trackedFiles = execFileSync('git', ['ls-files'], { cwd: repoPath, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  const hashOutput = trackedFiles.length
    ? execFileSync('git', ['hash-object', ...trackedFiles], { cwd: repoPath, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
    : [];

  const currentHashes = new Map(trackedFiles.map((file, i) => [file, hashOutput[i]]));

  const previous = db.prepare('SELECT path, hash FROM files').all() as { path: string; hash: string }[];
  const previousHashes = new Map(previous.map((row) => [row.path, row.hash]));

  const changed: string[] = [];
  for (const [file, hash] of currentHashes) {
    if (previousHashes.get(file) !== hash) changed.push(file);
  }

  const deleted: string[] = [];
  for (const file of previousHashes.keys()) {
    if (!currentHashes.has(file)) deleted.push(file);
  }

  const upsert = db.prepare('INSERT INTO files (path, hash) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET hash = excluded.hash');
  const del = db.prepare('DELETE FROM files WHERE path = ?');
  const tx = db.transaction(() => {
    for (const file of changed) upsert.run(file, currentHashes.get(file));
    for (const file of deleted) del.run(file);
  });
  tx();

  return { changed, deleted };
}
