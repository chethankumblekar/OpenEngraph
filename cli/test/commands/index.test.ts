import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIndex } from '../../src/commands/index.js';

const typescriptPluginDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../plugins/typescript');

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
});
