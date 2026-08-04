# Token-Reduction Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `benchmarks/` workspace package that indexes OpenEngraph's own repo via the real CLI, runs 8 questions across all three retrieval modes (structural/semantic/hybrid) through `QueryRouter`, and publishes a committed token-cost comparison against a grep-then-read-whole-file baseline in `benchmarks/RESULTS.md`.

**Architecture:** `run.ts` shells out to the already-built CLI (`node cli/dist/index.js index .`) to index the repo — the real user-facing path, not a duplicated internal pipeline — then imports `@openengraph/core`'s `QueryRouter`/`openDatabase` directly (the same consumption API the MCP server uses) to answer each question, computes the grep-based baseline for the same question, counts tokens both ways with a real BPE tokenizer, and writes the results table.

**Tech Stack:** TypeScript, `gpt-tokenizer` (pure-JS BPE tokenizer), `better-sqlite3` (via `@openengraph/core`), `git grep` for the baseline simulation.

## Global Constraints

- Internal workspace dependencies use npm's `"*"` wildcard, never `"workspace:*"` (npm doesn't support that pnpm/Yarn-only protocol).
- Every package's `tsconfig.json` sets `"outDir": "dist"` explicitly, never relying on inheriting it from `tsconfig.base.json` — a relative `outDir` inherited via `extends` resolves relative to the base config's directory (repo root), not the extending package's directory, silently breaking the build.
- ESM throughout (`"type": "module"`) — use `import.meta.url`-based path resolution, never `__dirname`/`__filename`.
- A package's `exports` map (if it needs one) must list every subpath actually imported from another workspace package.
- Any test exercising a real (non-type) cross-package import needs that package built first (`npm run build -w <package>`) — vitest's on-the-fly TS transpilation only covers same-package relative imports.
- License: Apache-2.0, matching every other package in this repo.

---

## File Structure

```
benchmarks/
  package.json                     # @openengraph/benchmarks, private: true
  tsconfig.json
  vitest.config.ts
  src/
    tokenCount.ts                   # wraps gpt-tokenizer (Task 1)
    baseline.ts                     # git-grep-then-read-whole-file (Task 2)
    queries.ts                      # the 8-question set (Task 3)
    run.ts                          # orchestration (Task 4)
  test/
    tokenCount.test.ts
    baseline.test.ts
    queries.test.ts
  RESULTS.md                        # committed real output (Task 4)
docs/COMPETITIVE_POSITIONING.md     # modified (Task 5)
README.md                           # new (Task 5)
```

---

### Task 1: Scaffold `benchmarks` package + token counting

**Files:**
- Create: `benchmarks/package.json`, `benchmarks/tsconfig.json`, `benchmarks/vitest.config.ts`
- Create: `benchmarks/src/tokenCount.ts`
- Test: `benchmarks/test/tokenCount.test.ts`

**Interfaces:**
- Produces: `countTokens(text: string): number` in `benchmarks/src/tokenCount.ts` — later tasks (`baseline.ts`, `run.ts`) call this to count tokens for both sides of the comparison.

- [ ] **Step 1: Write the failing test**

`benchmarks/test/tokenCount.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { countTokens } from '../src/tokenCount.js';

describe('countTokens', () => {
  it('returns 0 for empty text', () => {
    expect(countTokens('')).toBe(0);
  });

  it('returns a positive integer for non-empty text', () => {
    expect(countTokens('function greet(name) { return name; }')).toBeGreaterThan(0);
  });

  it('returns a larger count for longer text', () => {
    const short = countTokens('const x = 1;');
    const long = countTokens('const x = 1;\n'.repeat(50));
    expect(long).toBeGreaterThan(short);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w benchmarks`
Expected: FAIL — `benchmarks` package/module does not exist yet.

- [ ] **Step 3: Scaffold the package**

`benchmarks/package.json`:
```json
{
  "name": "@openengraph/benchmarks",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "dependencies": {
    "@openengraph/core": "*",
    "better-sqlite3": "^13.0.2",
    "gpt-tokenizer": "^2.5.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^9.6.0"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "run": "npm run build && node dist/run.js"
  }
}
```

`benchmarks/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "rootDir": "src", "outDir": "dist" }
}
```

`benchmarks/vitest.config.ts` (same pattern as every other package — the root config's glob is root-relative and doesn't match when vitest runs with `cwd=benchmarks/`, as `npm test -w benchmarks` does):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts']
  }
});
```

The root `package.json`'s `workspaces` array is currently `["core", "server", "plugins/*", "cli"]`, ordered so dependencies build before dependents (see its `_workspacesNote`). `benchmarks` depends on `core` at compile time and shells out to `cli`'s compiled output at runtime, so append it at the end: `["core", "server", "plugins/*", "cli", "benchmarks"]`. Run `npm install` at the repo root afterward.

- [ ] **Step 4: Implement `tokenCount.ts`**

```typescript
import { encode } from 'gpt-tokenizer';

export function countTokens(text: string): number {
  return encode(text).length;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w benchmarks`
Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add benchmarks package.json package-lock.json
git commit -m "feat(benchmarks): scaffold package and add token counting"
```

---

### Task 2: Baseline computation (grep-then-read-whole-file)

**Files:**
- Create: `benchmarks/src/baseline.ts`
- Test: `benchmarks/test/baseline.test.ts`

**Interfaces:**
- Consumes: `countTokens` (Task 1).
- Produces: `computeBaseline(repoRoot: string, grepTerms: string[]): { files: string[]; tokenCount: number }` in `benchmarks/src/baseline.ts` — Task 4's `run.ts` calls this once per benchmark question.

- [ ] **Step 1: Write the failing test**

`benchmarks/test/baseline.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeBaseline } from '../src/baseline.js';

describe('computeBaseline', () => {
  let repoRoot: string;

  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  it('includes only files matching a grep term, counting their full content', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oe-baseline-test-'));
    execSync('git init -q', { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'match.ts'), 'export function embedText() { return 1; }');
    writeFileSync(join(repoRoot, 'nomatch.ts'), 'export function unrelated() { return 2; }');
    execSync('git add -A', { cwd: repoRoot });

    const result = computeBaseline(repoRoot, ['embedText']);

    expect(result.files).toEqual(['match.ts']);
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it('unions files across multiple grep terms without double-counting', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oe-baseline-test-'));
    execSync('git init -q', { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'a.ts'), 'export function alpha() { return 1; }');
    writeFileSync(join(repoRoot, 'b.ts'), 'export function beta() { return 2; }');
    execSync('git add -A', { cwd: repoRoot });

    const result = computeBaseline(repoRoot, ['alpha', 'beta', 'alpha']);

    expect(result.files.sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('returns no files and zero tokens when no term matches', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oe-baseline-test-'));
    execSync('git init -q', { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'a.ts'), 'export function alpha() { return 1; }');
    execSync('git add -A', { cwd: repoRoot });

    const result = computeBaseline(repoRoot, ['doesNotExistAnywhere']);

    expect(result.files).toEqual([]);
    expect(result.tokenCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w benchmarks`
Expected: FAIL — `baseline.js` not found.

- [ ] **Step 3: Implement `baseline.ts`**

`git grep -l` exits with status `1` (not `0`) when no term matches, which `execFileSync` treats as an error by default — this must be handled explicitly, not left to throw.

```typescript
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countTokens } from './tokenCount.js';

export interface BaselineResult {
  files: string[];
  tokenCount: number;
}

function grepMatchingFiles(repoRoot: string, term: string): string[] {
  try {
    const out = execFileSync('git', ['grep', '-l', '-i', term], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16
    });
    return out.split('\n').filter(Boolean);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) return []; // git grep: no matches, not an error
    throw err;
  }
}

export function computeBaseline(repoRoot: string, grepTerms: string[]): BaselineResult {
  const fileSet = new Set<string>();
  for (const term of grepTerms) {
    for (const file of grepMatchingFiles(repoRoot, term)) {
      fileSet.add(file);
    }
  }

  const files = [...fileSet].sort();
  let tokenCount = 0;
  for (const file of files) {
    tokenCount += countTokens(readFileSync(join(repoRoot, file), 'utf8'));
  }

  return { files, tokenCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w benchmarks`
Expected: PASS (6/6 — 3 from Task 1, 3 from this task)

- [ ] **Step 5: Commit**

```bash
git add benchmarks/src/baseline.ts benchmarks/test/baseline.test.ts
git commit -m "feat(benchmarks): add grep-then-read-whole-file baseline"
```

---

### Task 3: Benchmark question set

**Files:**
- Create: `benchmarks/src/queries.ts`
- Test: `benchmarks/test/queries.test.ts`

**Interfaces:**
- Consumes: `QueryRouter` (type only) from `@openengraph/core/query/router.js`, `GraphResult` from `@openengraph/core/query/types.js`.
- Produces:
  ```typescript
  export interface BenchmarkQuestion {
    id: string;
    question: string;
    mode: 'structural' | 'semantic' | 'hybrid';
    grepTerms: string[];
    resolve: (router: QueryRouter, db: Database.Database) => Promise<GraphResult[]>;
  }
  export const BENCHMARK_QUESTIONS: BenchmarkQuestion[];
  export function resolveNodeIdByName(db: Database.Database, name: string): string | undefined;
  ```
  Task 4's `run.ts` iterates `BENCHMARK_QUESTIONS`, calling `resolve` for the OpenEngraph-side answer and `grepTerms` for the baseline side.

- [ ] **Step 1: Write the failing test**

`benchmarks/test/queries.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { BENCHMARK_QUESTIONS } from '../src/queries.js';

describe('BENCHMARK_QUESTIONS', () => {
  it('has exactly 8 questions with unique ids', () => {
    expect(BENCHMARK_QUESTIONS).toHaveLength(8);
    const ids = new Set(BENCHMARK_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(8);
  });

  it('covers all three retrieval modes', () => {
    const modes = new Set(BENCHMARK_QUESTIONS.map((q) => q.mode));
    expect(modes).toEqual(new Set(['structural', 'semantic', 'hybrid']));
  });

  it('gives every question at least one grep term', () => {
    for (const q of BENCHMARK_QUESTIONS) {
      expect(q.grepTerms.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w benchmarks`
Expected: FAIL — `queries.js` not found.

- [ ] **Step 3: Build `core` first**

This file's real (non-type) needs are minimal, but Task 4 depends on it and does real cross-package imports — build now so nothing is stale later.

Run: `npm run build -w core`

- [ ] **Step 4: Implement `queries.ts`**

```typescript
import type Database from 'better-sqlite3';
import type { QueryRouter } from '@openengraph/core/query/router.js';
import type { GraphResult } from '@openengraph/core/query/types.js';

export interface BenchmarkQuestion {
  id: string;
  question: string;
  mode: 'structural' | 'semantic' | 'hybrid';
  grepTerms: string[];
  resolve: (router: QueryRouter, db: Database.Database) => Promise<GraphResult[]>;
}

/**
 * QueryRouter.structuralQuery takes a node id, not a name -- core has no
 * name-based lookup (a known gap tracked separately, see the design doc).
 * The benchmark works around it locally with a direct SQL lookup rather than
 * adding a name-lookup API to core itself.
 */
export function resolveNodeIdByName(db: Database.Database, name: string): string | undefined {
  const row = db.prepare('SELECT id FROM nodes WHERE name = ?').get(name) as { id: string } | undefined;
  return row?.id;
}

async function structuralAnswer(db: Database.Database, router: QueryRouter, name: string): Promise<GraphResult[]> {
  const nodeId = resolveNodeIdByName(db, name);
  if (!nodeId) return [];
  return router.structuralQuery(nodeId);
}

export const BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  {
    id: 'structural-hybrid-query-calls',
    question: 'What does hybridQuery call?',
    mode: 'structural',
    grepTerms: ['hybridQuery'],
    resolve: (router, db) => structuralAnswer(db, router, 'hybridQuery')
  },
  {
    id: 'structural-build-graph-calls',
    question: 'What does buildGraph call?',
    mode: 'structural',
    grepTerms: ['buildGraph'],
    resolve: (router, db) => structuralAnswer(db, router, 'buildGraph')
  },
  {
    id: 'semantic-embedding-search',
    question: 'Where is embedding-based search implemented?',
    mode: 'semantic',
    grepTerms: ['embedText', 'MiniLM', 'embedding'],
    resolve: (router) => router.semanticQuery('embedding-based semantic search over code')
  },
  {
    id: 'semantic-cli-errors',
    question: 'How are CLI errors formatted for the user?',
    mode: 'semantic',
    grepTerms: ['describeError', 'CLI error'],
    resolve: (router) => router.semanticQuery('formatting a clean error message for the command line')
  },
  {
    id: 'semantic-go-method-detection',
    question: 'How does the Go plugin distinguish methods from functions?',
    mode: 'semantic',
    grepTerms: ['method_declaration', 'function_declaration'],
    resolve: (router) => router.semanticQuery('distinguishing a Go struct method from a top-level function')
  },
  {
    id: 'hybrid-schema-dependents',
    question: 'What depends on the SQLite storage schema?',
    mode: 'hybrid',
    grepTerms: ['applySchema', 'CREATE TABLE'],
    resolve: (router) => router.hybridQuery('the SQLite storage schema for nodes, edges, and chunks')
  },
  {
    id: 'hybrid-change-indexing',
    question: 'What code is involved in indexing a changed file?',
    mode: 'hybrid',
    grepTerms: ['detectChangedFiles', 'buildGraph', 'indexNodeChunks'],
    resolve: (router) => router.hybridQuery('indexing a file that changed since the last run')
  },
  {
    id: 'hybrid-mcp-exposure',
    question: 'What does the MCP server expose to AI assistants?',
    mode: 'hybrid',
    grepTerms: ['createMcpServer', 'graph_query', 'semantic_search', 'hybrid_query'],
    resolve: (router) => router.hybridQuery('MCP tools exposed to AI assistants for querying the graph')
  }
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w benchmarks`
Expected: PASS (9/9 — 6 from Tasks 1-2, 3 from this task)

- [ ] **Step 6: Commit**

```bash
git add benchmarks/src/queries.ts benchmarks/test/queries.test.ts
git commit -m "feat(benchmarks): add the 8-question benchmark set"
```

---

### Task 4: Orchestration script and real committed results

**Files:**
- Create: `benchmarks/src/run.ts`
- Create (committed real output): `benchmarks/RESULTS.md`

**Interfaces:**
- Consumes: `countTokens` (Task 1), `computeBaseline` (Task 2), `BENCHMARK_QUESTIONS`/`resolveNodeIdByName` (Task 3), `openDatabase` from `@openengraph/core/storage/db.js`, `QueryRouter` from `@openengraph/core/query/router.js`.
- Produces: no new consumed-by-others interface — this is the final orchestration entry point, run via `npm run run -w benchmarks`.

This task has no unit test (per the design doc's Section 8: `run.ts` is an orchestration script that shells out and writes a file — its correctness is verified by actually running it and inspecting the output, the same way `npm run build` isn't unit-tested). Its steps are implement, run for real, sanity-check, fix if needed, commit the code and the real output together.

- [ ] **Step 1: Build prerequisites**

`run.ts` imports `@openengraph/core` via real cross-package imports and shells out to the built CLI.

Run: `npm run build -w core && npm run build -w cli`

- [ ] **Step 2: Implement `run.ts`**

```typescript
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { QueryRouter } from '@openengraph/core/query/router.js';
import { countTokens } from './tokenCount.js';
import { computeBaseline } from './baseline.js';
import { BENCHMARK_QUESTIONS } from './queries.js';

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDir, '..', '..'); // benchmarks/src -> benchmarks -> repo root
const cliEntry = join(repoRoot, 'cli', 'dist', 'index.js');

interface RowResult {
  id: string;
  question: string;
  mode: string;
  openEngraphTokens: number;
  baselineTokens: number;
  reductionPct: number;
}

async function main(): Promise<void> {
  console.log(`Indexing ${repoRoot} via the real CLI...`);
  execFileSync('node', [cliEntry, 'index', repoRoot], { cwd: repoRoot, stdio: 'inherit' });

  const db = openDatabase(join(repoRoot, '.openengraph', 'graph.db'));
  const router = new QueryRouter(db);

  const rows: RowResult[] = [];
  for (const q of BENCHMARK_QUESTIONS) {
    const answer = await q.resolve(router, db);
    const openEngraphTokens = countTokens(JSON.stringify(answer));

    const baseline = computeBaseline(repoRoot, q.grepTerms);
    const baselineTokens = baseline.tokenCount;

    const reductionPct = baselineTokens === 0 ? 0 : Math.round((1 - openEngraphTokens / baselineTokens) * 1000) / 10;

    rows.push({ id: q.id, question: q.question, mode: q.mode, openEngraphTokens, baselineTokens, reductionPct });
    console.log(`${q.id}: OpenEngraph=${openEngraphTokens} baseline=${baselineTokens} reduction=${reductionPct}%`);
  }

  db.close();
  writeResults(rows);
}

function writeResults(rows: RowResult[]): void {
  const avgReduction = Math.round((rows.reduce((sum, r) => sum + r.reductionPct, 0) / rows.length) * 10) / 10;
  const date = new Date().toISOString().slice(0, 10);

  const lines = [
    '# Token-Reduction Benchmark Results',
    '',
    `Last run: ${date}`,
    '',
    'Methodology: indexes this repository via `openengraph index`, answers each question through `QueryRouter` (the same API the MCP server uses), and compares the token cost of that answer against a simulated naive-agent baseline (`git grep -l` for the question\'s keywords, then the full content of every matching file). Tokens counted with `gpt-tokenizer` (cl100k_base).',
    '',
    '| Question | Mode | OpenEngraph tokens | Baseline tokens | Reduction |',
    '|---|---|---|---|---|',
    ...rows.map(
      (r) => `| ${r.question} | ${r.mode} | ${r.openEngraphTokens} | ${r.baselineTokens} | ${r.reductionPct}% |`
    ),
    '',
    `**Average reduction across all ${rows.length} questions: ${avgReduction}%**`,
    ''
  ];

  writeFileSync(join(repoRoot, 'benchmarks', 'RESULTS.md'), lines.join('\n'));
  console.log(`\nWrote benchmarks/RESULTS.md (average reduction: ${avgReduction}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Build and run it for real**

Run: `npm run build -w benchmarks && node benchmarks/dist/run.js`

Expected: it indexes the repo, prints one line per question, and writes `benchmarks/RESULTS.md`.

- [ ] **Step 4: Sanity-check the real output**

Read the generated `benchmarks/RESULTS.md`. For each row, confirm `openEngraphTokens > 0` (a non-empty, meaningful answer) and `baselineTokens > openEngraphTokens` (the claim actually holds). If any row shows `openEngraphTokens = 0` (the structural questions' `resolveNodeIdByName` found no matching node, or a semantic/hybrid query returned nothing), do not fudge the numbers — investigate why: for the two structural questions, confirm the exact name (`hybridQuery`, `buildGraph`) exists in the `nodes` table (`sqlite3 .openengraph/graph.db "SELECT kind, name, file FROM nodes WHERE name IN ('hybridQuery','buildGraph')"` from the repo root, or equivalent), and if the specific relationship this question probes for doesn't hold in the current codebase, replace that question in `queries.ts` (Task 3's file) with a different real, verifiable relationship in the same file, re-run, and re-verify. Do not publish a row with a zero or misleading value.

- [ ] **Step 5: Re-run the full monorepo test suite as a final sanity check**

Run: `npm test`
Expected: all pre-existing tests still pass (this task didn't touch other packages' source, but confirms nothing was accidentally broken by the workspace/root `package.json` change from Task 1).

- [ ] **Step 6: Commit the code and the real results together**

```bash
git add benchmarks/src/run.ts benchmarks/RESULTS.md
git commit -m "feat(benchmarks): add orchestration script, publish real results"
```

---

### Task 5: Link results from the competitive positioning doc and add a README

**Files:**
- Modify: `docs/COMPETITIVE_POSITIONING.md`
- Create: `README.md`

**Interfaces:** none — pure documentation, no code interfaces produced or consumed. This task depends on Task 4's real `benchmarks/RESULTS.md` existing so its numbers can be quoted here (read the actual committed file — the exact average-reduction percentage is not known until Task 4 has run for real, so this task must not hardcode a placeholder percentage; copy the real number from the committed `benchmarks/RESULTS.md`).

- [ ] **Step 1: Add a pointer in the competitive positioning doc**

Find the `## Why hybrid, why now` section in `docs/COMPETITIVE_POSITIONING.md` and add one paragraph immediately after it:

```markdown
## Benchmark

`benchmarks/RESULTS.md` (run via `npm run run -w benchmarks`) measures this directly: token cost of answering real questions about this repository through `QueryRouter` versus a simulated naive-agent baseline (grep for keywords, read the matching files in full). As of the last run, average token reduction across 8 questions spanning all three retrieval modes was **<COPY THE REAL AVERAGE FROM benchmarks/RESULTS.md HERE>**.
```

Replace the placeholder text in angle brackets with the actual number from `benchmarks/RESULTS.md`'s "Average reduction" line — do not leave the placeholder in the committed file.

- [ ] **Step 2: Create the root README**

`README.md` — covers what the final whole-branch review flagged as missing (install/build/usage instructions) plus the headline benchmark number:

```markdown
# OpenEngraph

A local-first engineering knowledge graph: index a repository into a structural graph (tree-sitter) plus a local embedding index, and query it with a hybrid retrieval router — deterministic graph traversal first, semantic search when structure runs out. No code leaves your machine; embeddings run through a local ONNX model, not a remote API.

## Why

AI coding assistants re-read the same files and rebuild the same context every session. OpenEngraph persists that context as a queryable graph instead. On this repository's own codebase, that cuts the token cost of answering real questions by an average of **<COPY THE REAL AVERAGE FROM benchmarks/RESULTS.md HERE>** compared to the naive alternative (grep for keywords, read the matching files in full) — see [`benchmarks/RESULTS.md`](benchmarks/RESULTS.md) for the full breakdown and methodology.

## Install & build

This is an npm workspaces monorepo. From the repo root:

```bash
npm install
npm run build
```

Workspace build order matters (`core` and `server` compile before `cli`, which imports both) — always use `npm run build` at the root rather than building a single package in isolation unless its dependencies are already built.

## Usage

```bash
# Index a repository
node cli/dist/index.js index /path/to/repo

# Start a local MCP server over the indexed repository
node cli/dist/index.js mcp /path/to/repo
```

Point any MCP-compatible AI assistant at the `mcp` command's stdio transport to expose three tools: `graph_query` (structural), `semantic_search` (fuzzy), and `hybrid_query` (both).

## Language support

TypeScript, Python, and Go, via tree-sitter WASM grammars in `plugins/`. See `plugins/GOVERNANCE.md` for the plugin contract and review checklist if you're adding a new language.

## Project structure

- `core/` — storage, change detection, plugin system, graph builder, embeddings, query router
- `cli/` — the `openengraph` command
- `server/` — the MCP server
- `plugins/` — language plugins (TypeScript, Python, Go)
- `benchmarks/` — the token-reduction benchmark
- `docs/` — architecture, competitive positioning, and design/plan history

## License

Apache-2.0.
```

Replace both placeholder angle-bracket instances with the real number from `benchmarks/RESULTS.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/COMPETITIVE_POSITIONING.md README.md
git commit -m "docs: link benchmark results from positioning doc, add README"
```

---

## Self-Review Notes

- **Spec coverage**: design doc Section 3 (architecture) → Tasks 1-4; Section 4 (query set) → Task 3; Section 5 (baseline) → Task 2; Section 6 (token counting) → Task 1; Section 7 (output/publication) → Tasks 4-5; Section 8 (testing) → Tasks 1-3 (unit tests), Task 4 (integration verification, explicitly not unit-tested per the design); Section 9 (out of scope) → not built, correctly excluded.
- **Type consistency checked**: `BenchmarkQuestion`/`resolveNodeIdByName` (Task 3) match their usage in `run.ts` (Task 4) exactly — same parameter order (`router, db`), same return type (`Promise<GraphResult[]>`). `computeBaseline`'s return shape (`{ files, tokenCount }`, Task 2) matches how `run.ts` destructures it (Task 4).
- **No placeholders**: the two angle-bracket "COPY THE REAL AVERAGE" markers in Task 5 are not placeholder content left unfixed — they are explicit instructions to the implementer to substitute Task 4's actual, already-generated output, since the true percentage cannot be known until the benchmark has actually run (hardcoding a guessed number here would be worse than an explicit copy-from-real-output instruction).
