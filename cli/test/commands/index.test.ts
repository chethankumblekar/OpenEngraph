import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { runIndex } from '../../src/commands/index.js';

const typescriptPluginDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../plugins/typescript');

interface NodeRow {
  id: string;
  name: string;
  start_line: number;
  end_line: number;
}

function readNodes(repoPath: string): NodeRow[] {
  const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
  try {
    return db
      .prepare('SELECT id, name, start_line, end_line FROM nodes ORDER BY start_line')
      .all() as NodeRow[];
  } finally {
    db.close();
  }
}

describe('runIndex', () => {
  let repoPath: string;

  afterEach(() => rmSync(repoPath, { recursive: true, force: true }));

  it('indexes a repo and creates .openengraph/graph.db', async () => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-cli-test-'));
    execSync('git init -q', { cwd: repoPath });
    writeFileSync(join(repoPath, 'a.ts'), 'export function greet() { return 1; }');
    execSync('git add a.ts', { cwd: repoPath });

    const result = await runIndex(repoPath, [typescriptPluginDir]);

    expect(result.filesIndexed).toBe(1);
    expect(existsSync(join(repoPath, '.openengraph', 'graph.db'))).toBe(true);
  }, 30_000);

  it('keeps the index out of the indexed repo\'s own git tracking', async () => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-cli-gitignore-'));
    execSync('git init -q', { cwd: repoPath });
    writeFileSync(join(repoPath, 'a.ts'), 'export function greet() { return 1; }');
    execSync('git add a.ts', { cwd: repoPath });

    await runIndex(repoPath, [typescriptPluginDir]);

    expect(readFileSync(join(repoPath, '.openengraph', '.gitignore'), 'utf8')).toBe('*\n');
    execSync('git add -A', { cwd: repoPath });
    const tracked = execSync('git ls-files', { cwd: repoPath, encoding: 'utf8' });
    expect(tracked).not.toMatch(/\.openengraph/);
  }, 30_000);

  it('re-indexes an edited file instead of crashing or serving stale nodes', async () => {
    // Regression for two bugs that compounded: deleting a file's nodes threw
    // FOREIGN KEY errors once chunks existed, and the file hash was committed
    // before indexing succeeded, so the next run reported "0 files indexed"
    // while the graph still held pre-edit content.
    repoPath = mkdtempSync(join(tmpdir(), 'oe-cli-reindex-'));
    execSync('git init -q', { cwd: repoPath });
    writeFileSync(join(repoPath, 'a.ts'), 'export function greet() {\n  return 1;\n}\n');
    execSync('git add -A', { cwd: repoPath });

    const first = await runIndex(repoPath, [typescriptPluginDir]);
    expect(first.filesIndexed).toBe(1);
    expect(readNodes(repoPath)).toEqual([
      { id: 'a.ts:function:greet:1', name: 'greet', start_line: 1, end_line: 3 }
    ]);

    // Edit the file: `greet` moves down and a second function appears.
    writeFileSync(
      join(repoPath, 'a.ts'),
      '// a new leading comment\n\nexport function greet() {\n  return 2;\n}\n\nexport function welcome() {\n  return greet();\n}\n'
    );
    execSync('git add -A', { cwd: repoPath });

    const second = await runIndex(repoPath, [typescriptPluginDir]);
    expect(second.filesIndexed).toBe(1);
    expect(readNodes(repoPath)).toEqual([
      { id: 'a.ts:function:greet:3', name: 'greet', start_line: 3, end_line: 5 },
      { id: 'a.ts:function:welcome:7', name: 'welcome', start_line: 7, end_line: 9 }
    ]);

    // A third run with no edits is a genuine no-op.
    const third = await runIndex(repoPath, [typescriptPluginDir]);
    expect(third.filesIndexed).toBe(0);
  }, 60_000);

  it('removes deleted files from the graph', async () => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-cli-delete-'));
    execSync('git init -q', { cwd: repoPath });
    writeFileSync(join(repoPath, 'a.ts'), 'export function greet() { return 1; }');
    writeFileSync(join(repoPath, 'b.ts'), 'export function farewell() { return 2; }');
    execSync('git add -A', { cwd: repoPath });

    await runIndex(repoPath, [typescriptPluginDir]);
    expect(readNodes(repoPath).map((n) => n.name).sort()).toEqual(['farewell', 'greet']);

    rmSync(join(repoPath, 'b.ts'));
    execSync('git add -A', { cwd: repoPath });

    const result = await runIndex(repoPath, [typescriptPluginDir]);
    expect(result.filesRemoved).toBe(1);
    expect(readNodes(repoPath).map((n) => n.name)).toEqual(['greet']);

    const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
    try {
      expect(db.prepare("SELECT COUNT(*) AS n FROM chunks WHERE node_id LIKE 'b.ts%'").get()).toEqual({
        n: 0
      });
      expect(db.prepare("SELECT COUNT(*) AS n FROM files WHERE path = 'b.ts'").get()).toEqual({ n: 0 });
    } finally {
      db.close();
    }
  }, 60_000);
});
