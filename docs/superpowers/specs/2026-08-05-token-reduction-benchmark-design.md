# Token-Reduction Benchmark — Design

> Date: 2026-08-05
> Status: Approved (brainstorm), pending implementation planning

## 1. Goal

Substantiate OpenEngraph's core competitive claim — that structured retrieval (graph + local embeddings) costs an AI assistant far fewer tokens than reading raw files to answer the same question — with a real, reproducible number, published in `benchmarks/RESULTS.md` and linked from `docs/COMPETITIVE_POSITIONING.md` and the README. Every OSS competitor surveyed during the differentiation design work (CodeGraph, codebase-memory-mcp) already publishes a number like this; OpenEngraph currently doesn't.

## 2. Scope decisions

1. **Corpus**: OpenEngraph's own repository (`core/`, `cli/`, `server/`, `plugins/*`). Zero external dependencies, reproducible by anyone who clones the repo. Trade-off accepted: mostly TypeScript, doesn't showcase Python/Go language coverage, and is a self-benchmark rather than a third-party corpus — acceptable for this first published number; a larger/external-repo benchmark is a reasonable future addition, not required now.
2. **Baseline methodology**: simulate a naive agent's actual behavior — `git grep -l` for each question's keyword set, union the matching files, count tokens for their **full contents**. This is directly comparable to OpenEngraph's retrieval because it's the same discovery step (find relevant code) that semantic/hybrid search replaces.
3. **Token counting**: a real BPE tokenizer (`gpt-tokenizer`, pure-JS, no network call, no API key), not a char/4 heuristic — the published number needs to hold up to scrutiny.
4. **Publication**: results are committed to `benchmarks/RESULTS.md`, regenerated each time the benchmark is run, and linked from `docs/COMPETITIVE_POSITIONING.md` and a new README.

## 3. Architecture

A new workspace package, `benchmarks/`, mirroring the existing `cli`/`server`/`plugins/*` pattern rather than a standalone script — consistent with the rest of the monorepo, and gives the harness type-checked access to `QueryRouter`'s real types.

```
benchmarks/
  package.json          # @openengraph/benchmarks, private: true
  tsconfig.json
  src/
    queries.ts           # the fixed question set (Section 4)
    tokenCount.ts         # wraps gpt-tokenizer
    baseline.ts           # grep-then-read-whole-file simulation
    run.ts                # orchestrates the full benchmark run
  test/
    tokenCount.test.ts
    baseline.test.ts
  RESULTS.md              # committed output, regenerated on each run
```

**Indexing step**: `run.ts` shells out to the real, already-built CLI (`node cli/dist/index.js index <repo-root>`) rather than reimplementing the indexing pipeline internally — this exercises the actual user-facing path a real OpenEngraph user runs, avoiding a second internal pipeline that could silently drift from the real one (the class of bug the final whole-branch review found elsewhere in this project).

**Query step**: `run.ts` imports `@openengraph/core`'s `QueryRouter` and `openDatabase` directly and opens the `.openengraph/graph.db` the indexing step just created — the same consumption API the MCP server uses, not a separate benchmark-only code path.

## 4. Query set

8 questions spanning all three retrieval modes, each a real question about OpenEngraph's own code:

| # | Question | Mode | Resolution |
|---|---|---|---|
| 1 | What does `hybridQuery` call? | structural | resolve starting node by exact name via a direct SQL lookup (`SELECT id FROM nodes WHERE name = ?`), then `QueryRouter.structuralQuery` |
| 2 | What does `buildGraph` call? | structural | same pattern as #1 |
| 3 | Where is embedding-based search implemented? | semantic | `QueryRouter.semanticQuery` |
| 4 | How are CLI errors formatted for the user? | semantic | `QueryRouter.semanticQuery` |
| 5 | How does the Go plugin distinguish methods from functions? | semantic | `QueryRouter.semanticQuery` |
| 6 | What depends on the SQLite storage schema? | hybrid | `QueryRouter.hybridQuery` |
| 7 | What code is involved in indexing a changed file? | hybrid | `QueryRouter.hybridQuery` |
| 8 | What does the MCP server expose to AI assistants? | hybrid | `QueryRouter.hybridQuery` |

`QueryRouter` has no name-based lookup (only ID-based `structuralQuery`) — this is a known gap flagged by the final whole-branch review as Important #3 in the OSS Phase 1 MVP plan. Questions #1-2 work around it locally inside the benchmark harness (a direct SQL query against the `nodes` table) rather than adding a name-lookup API to `core` itself — that's out of scope for a benchmark tool; fixing the underlying gap in `QueryRouter` is separate follow-up work, not bundled into this design.

Each question is defined in `queries.ts` as:
```typescript
interface BenchmarkQuestion {
  id: string;
  question: string;
  mode: 'structural' | 'semantic' | 'hybrid';
  grepTerms: string[];       // for the baseline
  resolve: (router: QueryRouter, db: Database.Database) => Promise<GraphResult[]>;
}
```

## 5. Baseline computation

`baseline.ts` exports `computeBaseline(repoRoot: string, grepTerms: string[]): { files: string[]; tokenCount: number }`:
1. For each term, run `git grep -l -i <term>` (case-insensitive, matching how a naive keyword search would behave) scoped to `repoRoot`.
2. Union the matched file paths across all terms (a file matching any term is included once).
3. Read each file's full content and sum token counts via `tokenCount.ts`.

## 6. Token counting

`tokenCount.ts` wraps `gpt-tokenizer`'s `encode()` and exports `countTokens(text: string): number`. Used identically for both sides of the comparison (OpenEngraph's JSON query response vs. the baseline's raw file contents) so the comparison is apples-to-apples.

## 7. Output format

`RESULTS.md`:
- One-line methodology note (corpus, baseline method, tokenizer used) and the date the benchmark was last run.
- A table: Question | Mode | OpenEngraph tokens | Baseline tokens | Reduction %.
- An aggregate row: average reduction % across all 8 questions.

`docs/COMPETITIVE_POSITIONING.md` gains a one-line pointer to this file in its "Why hybrid, why now" section. A new root `README.md` (currently absent — flagged by the final whole-branch review as a gap independent of this benchmark) gets a one-line summary of the headline number plus a link to `benchmarks/RESULTS.md`, alongside basic install/usage instructions for the CLI.

## 8. Testing

`tokenCount.test.ts`: `countTokens` returns a positive integer for non-empty text, `0` for empty text, and a larger count for longer text (sanity bounds, not exact-value assertions, since exact BPE output isn't worth hand-verifying).

`baseline.test.ts`: `computeBaseline` against a small temp git repo fixture (same `mkdtempSync` + `git init` pattern used throughout `core/test/`) with a few files, some matching a grep term and some not — assert only matching files are counted, and token count reflects their full content.

`run.ts` itself is not unit-tested (it's an orchestration script that shells out and writes a file) — its correctness is verified by actually running it and inspecting `RESULTS.md`, the same way `npm run build` isn't unit-tested.

## 9. Out of scope

- Benchmarking against an external/third-party repo (noted as a credible future addition in Section 2).
- Fixing `QueryRouter`'s missing name-lookup API (Section 4's known gap) — the benchmark works around it locally, the underlying gap is separate follow-up work.
- Indexing-performance benchmarking (time/memory to index a large repo) — the user explicitly chose token-reduction over this when scoping the work.
