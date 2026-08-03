import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIndex } from '../../../cli/src/commands/index.js';
import { openDatabase } from '../../src/storage/db.js';
import { QueryRouter } from '../../src/query/router.js';

const testDir = dirname(fileURLToPath(import.meta.url)); // core/test/integration
const monorepoRoot = resolve(testDir, '..', '..', '..'); // -> core/test -> core -> repo root

describe('end-to-end indexing and querying', () => {
  let repoPath: string;

  beforeAll(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-e2e-'));
    cpSync(resolve(testDir, '..', 'fixtures', 'sample-repo'), repoPath, { recursive: true });
    execSync('git init -q && git add -A', { cwd: repoPath });
  });

  afterAll(() => rmSync(repoPath, { recursive: true, force: true }));

  it('indexes all three languages and answers a hybrid query', async () => {
    const result = await runIndex(repoPath, [
      join(monorepoRoot, 'plugins', 'typescript'),
      join(monorepoRoot, 'plugins', 'python'),
      join(monorepoRoot, 'plugins', 'go')
    ]);
    expect(result.filesIndexed).toBe(3);

    const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
    const router = new QueryRouter(db);
    const results = await router.hybridQuery('function that greets someone by name', 5);
    const names = results.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['greet', 'Greet']));
  }, 60_000);
});
