import { execFileSync } from 'node:child_process';
import type Database from 'better-sqlite3';

/**
 * How many paths to pass to a single `git hash-object` invocation. Passing the
 * whole tracked-file list at once overflows the OS argv limit (`E2BIG`) on any
 * reasonably sized repository, so the list is chunked.
 */
const HASH_BATCH_SIZE = 500;

export interface ChangeDetectionResult {
  /** Tracked files whose content hash differs from what was last indexed. */
  changed: string[];
  /** Files recorded as indexed that git no longer tracks. */
  deleted: string[];
  /** Current git blob hash for every tracked file, keyed by repo-relative path. */
  hashes: Map<string, string>;
}

/**
 * Compares the repo's current `git hash-object` values against the `files`
 * table and reports what changed.
 *
 * This function deliberately does *not* write to the `files` table. A file's
 * hash may only be recorded once its graph and embedding rows actually exist,
 * otherwise a crash mid-index leaves the hash committed and the graph stale —
 * and every subsequent run reports "0 files indexed" while silently serving
 * pre-edit data. Callers persist progress with `recordIndexedFile` /
 * `forgetIndexedFile` after each file succeeds.
 */
export function detectChangedFiles(repoPath: string, db: Database.Database): ChangeDetectionResult {
  const trackedFiles = execFileSync('git', ['ls-files'], {
    cwd: repoPath,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
    // Capture git's stderr onto the thrown error instead of letting execFileSync
    // forward it straight to our own stderr, so callers can render one clean
    // message ("… is not a git repository") rather than git's raw output too.
    stdio: ['ignore', 'pipe', 'pipe']
  })
    .split('\n')
    .filter(Boolean);

  const hashOutput: string[] = [];
  for (let i = 0; i < trackedFiles.length; i += HASH_BATCH_SIZE) {
    const batch = trackedFiles.slice(i, i + HASH_BATCH_SIZE);
    const out = execFileSync('git', ['hash-object', ...batch], {
      cwd: repoPath,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 64
    })
      .split('\n')
      .filter(Boolean);
    hashOutput.push(...out);
  }

  const hashes = new Map(trackedFiles.map((file, i) => [file, hashOutput[i]]));

  const previous = db.prepare('SELECT path, hash FROM files').all() as { path: string; hash: string }[];
  const previousHashes = new Map(previous.map((row) => [row.path, row.hash]));

  const changed: string[] = [];
  for (const [file, hash] of hashes) {
    if (previousHashes.get(file) !== hash) changed.push(file);
  }

  const deleted: string[] = [];
  for (const file of previousHashes.keys()) {
    if (!hashes.has(file)) deleted.push(file);
  }

  return { changed, deleted, hashes };
}

/** Marks `filePath` as successfully indexed at content hash `hash`. */
export function recordIndexedFile(db: Database.Database, filePath: string, hash: string): void {
  db.prepare(
    'INSERT INTO files (path, hash) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET hash = excluded.hash'
  ).run(filePath, hash);
}

/** Drops `filePath` from the indexed-file record (it is gone from the repo). */
export function forgetIndexedFile(db: Database.Database, filePath: string): void {
  db.prepare('DELETE FROM files WHERE path = ?').run(filePath);
}
