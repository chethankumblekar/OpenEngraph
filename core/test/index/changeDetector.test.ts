import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import { detectChangedFiles } from '../../src/index/changeDetector.js';

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
  });

  it('reports no changes on a second run with no edits', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    detectChangedFiles(repoPath, db);
    const second = detectChangedFiles(repoPath, db);
    expect(second.changed).toEqual([]);
  });

  it('detects a deleted file', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    detectChangedFiles(repoPath, db);
    rmSync(join(repoPath, 'a.ts'));
    execSync('git add -A', { cwd: repoPath });
    const result = detectChangedFiles(repoPath, db);
    expect(result.deleted).toEqual(['a.ts']);
  });
});
