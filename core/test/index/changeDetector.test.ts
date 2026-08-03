import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import {
  detectChangedFiles,
  recordIndexedFile,
  forgetIndexedFile
} from '../../src/index/changeDetector.js';

/** Stands in for a caller that successfully indexed everything it was given. */
function markAllIndexed(db: ReturnType<typeof openDatabase>, repoPath: string) {
  const result = detectChangedFiles(repoPath, db);
  for (const file of result.changed) recordIndexedFile(db, file, result.hashes.get(file)!);
  for (const file of result.deleted) forgetIndexedFile(db, file);
  return result;
}

describe('detectChangedFiles', () => {
  let repoPath: string;

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-test-'));
    execSync('git init -q', { cwd: repoPath });
    writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;');
    execSync('git add a.ts', { cwd: repoPath });
  });

  afterEach(() => rmSync(repoPath, { recursive: true, force: true }));

  it('reports all tracked files as changed on first run', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    const result = detectChangedFiles(repoPath, db);
    expect(result.changed).toEqual(['a.ts']);
    expect(result.deleted).toEqual([]);
    expect(result.hashes.get('a.ts')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('reports no changes on a second run once the caller records success', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    markAllIndexed(db, repoPath);
    const second = detectChangedFiles(repoPath, db);
    expect(second.changed).toEqual([]);
  });

  it('keeps reporting a file as changed until the caller records it as indexed', () => {
    // The invariant that keeps a crashed index run from going silently stale:
    // detection alone must never mark a file as done.
    const db = openDatabase(':memory:');
    applySchema(db);
    detectChangedFiles(repoPath, db);
    detectChangedFiles(repoPath, db);
    expect(detectChangedFiles(repoPath, db).changed).toEqual(['a.ts']);
  });

  it('detects a deleted file', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    markAllIndexed(db, repoPath);
    rmSync(join(repoPath, 'a.ts'));
    execSync('git add -A', { cwd: repoPath });
    const result = detectChangedFiles(repoPath, db);
    expect(result.deleted).toEqual(['a.ts']);
  });

  it('hashes more files than fit in a single git argv', () => {
    // Exercises the batching that keeps `git hash-object` from hitting E2BIG.
    const db = openDatabase(':memory:');
    applySchema(db);
    for (let i = 0; i < 1200; i++) {
      writeFileSync(join(repoPath, `f${i}.ts`), `export const f${i} = ${i};`);
    }
    execSync('git add -A', { cwd: repoPath });
    const result = detectChangedFiles(repoPath, db);
    expect(result.changed).toHaveLength(1201);
    expect(result.hashes.size).toBe(1201);
    for (const hash of result.hashes.values()) expect(hash).toMatch(/^[0-9a-f]{40}$/);
  }, 30_000);
});
