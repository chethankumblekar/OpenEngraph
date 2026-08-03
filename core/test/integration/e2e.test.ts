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

const GREETING_QUERY = 'function that greets someone by name';

describe('end-to-end indexing and querying', () => {
  let repoPath: string;
  let db: ReturnType<typeof openDatabase>;
  let router: QueryRouter;

  beforeAll(async () => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-e2e-'));
    cpSync(resolve(testDir, '..', 'fixtures', 'sample-repo'), repoPath, { recursive: true });
    execSync('git init -q && git add -A', { cwd: repoPath });

    const result = await runIndex(repoPath, [
      join(monorepoRoot, 'plugins', 'typescript'),
      join(monorepoRoot, 'plugins', 'python'),
      join(monorepoRoot, 'plugins', 'go')
    ]);
    expect(result.filesIndexed).toBe(3);

    db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
    router = new QueryRouter(db);
  }, 120_000);

  afterAll(() => {
    db?.close();
    rmSync(repoPath, { recursive: true, force: true });
  });

  it('answers a hybrid query across all three languages', async () => {
    const results = await router.hybridQuery(GREETING_QUERY, 5);
    const names = results.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['greet', 'Greet']));
  }, 60_000);

  it('builds structural edges for same-file calls in every language', () => {
    const edges = db
      .prepare('SELECT source_id, target_id FROM edges')
      .all() as { source_id: string; target_id: string }[];
    expect(edges.length).toBeGreaterThan(0);

    // welcome() -> greet() and greet() -> auditQuotaLedger() in each fixture.
    const expected = [
      ['greet.ts:function:welcome:13', 'greet.ts:function:greet:8'],
      ['greet.ts:function:greet:8', 'greet.ts:function:auditQuotaLedger:4'],
      ['greet.py:function:welcome:10', 'greet.py:function:greet:5'],
      ['greet.py:function:greet:5', 'greet.py:function:audit_quota_ledger:1'],
      ['greet.go:function:Welcome:12', 'greet.go:function:Greet:7'],
      ['greet.go:function:Greet:7', 'greet.go:function:AuditQuotaLedger:3']
    ];
    const actual = new Set(edges.map((e) => `${e.source_id}->${e.target_id}`));
    for (const [source, target] of expected) {
      expect(actual).toContain(`${source}->${target}`);
    }
  });

  it('traverses an edge with structuralQuery, without touching embeddings', () => {
    const hops = router.structuralQuery('greet.ts:function:welcome:13', 'REFERENCES');
    expect(hops).toEqual([expect.objectContaining({ name: 'greet', file: 'greet.ts', via: 'graph' })]);
  });

  it('hybridQuery reaches nodes the embedding search alone never returns', async () => {
    const seeds = await router.semanticQuery(GREETING_QUERY, 3);
    const seedIds = new Set(seeds.map((s) => s.id));

    // auditQuotaLedger / audit_quota_ledger / AuditQuotaLedger are named so
    // they are not semantic matches for a greeting query — the only way to
    // reach them is by following an edge out of a greet* seed.
    const isAudit = (name: string) => /audit/i.test(name);
    expect(seeds.some((s) => isAudit(s.name))).toBe(false);

    const results = await router.hybridQuery(GREETING_QUERY, 3);
    const expanded = results.filter((r) => !seedIds.has(r.id));
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((r) => r.via === 'graph')).toBe(true);

    // hybridQuery is exactly the seeds plus one structural hop off each seed.
    const expectedIds = new Set(seedIds);
    for (const seed of seeds) {
      for (const hop of router.structuralQuery(seed.id)) expectedIds.add(hop.id);
    }
    expect(new Set(results.map((r) => r.id))).toEqual(expectedIds);
  }, 60_000);
});
