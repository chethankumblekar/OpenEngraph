# Changelog

All notable changes to OpenEngraph are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-08-06

Initial release: the OSS Phase 1 MVP, a token-reduction benchmark substantiating the core competitive claim, and the infrastructure to keep both maintained.

### Added — Core engine

- Local-first structural + semantic hybrid retrieval engine (`core/`): SQLite-backed graph storage, git-aware incremental change detection, a local embedding index (`Xenova/all-MiniLM-L6-v2`, no external API), and a `QueryRouter` exposing structural, semantic, and hybrid (graph + embeddings) queries.
- `openengraph index <path>` and `openengraph mcp <path>` CLI commands (`cli/`).
- A local MCP server (`server/`) exposing `graph_query`, `semantic_search`, and `hybrid_query` tools over stdio, for any MCP-compatible AI assistant.
- Language plugins for TypeScript, Python, and Go (`plugins/`), each extracting functions, methods, classes/structs, imports, and same-file call/reference edges — the structural graph actually has edges, not just nodes. Plugin governance and review checklist in `plugins/GOVERNANCE.md`.

### Added — Benchmark

- `benchmarks/`: a reproducible token-reduction benchmark comparing OpenEngraph's hybrid retrieval against a simulated naive-agent baseline (grep + read full files) across 8 real questions spanning all three retrieval modes. Results, methodology, and full provenance disclosure in `benchmarks/RESULTS.md`, regenerated on every run — including automatic sync of the headline number into `README.md` and `docs/COMPETITIVE_POSITIONING.md`.

### Added — Documentation

- `README.md`, `docs/COMPETITIVE_POSITIONING.md` (competitor landscape and differentiation argument), `docs/COMPETITIVE_FEATURE_MATRIX.md` (feature-by-feature comparison against 8 tracked competitors, refreshed weekly).
- Design and implementation plan history under `docs/superpowers/` (foundation spec, differentiation design, OSS Phase 1 MVP plan, benchmark design/plan).

### Added — Automation

- `.github/workflows/ci.yml` — build + test on every push/PR.
- `.github/workflows/benchmark.yml` — weekly automated benchmark refresh (Monday 04:30 UTC), committing updated numbers only when they change.
- `.github/workflows/release.yml` — GitHub Release creation on `v*` tag push.
- A separate weekly cloud-agent routine (Monday 03:30 UTC) refreshes `docs/COMPETITIVE_FEATURE_MATRIX.md` against freshly-verified competitor data.

### Fixed

- Re-indexing an edited file no longer crashes on a foreign-key constraint or silently leaves the graph stale (`ON DELETE CASCADE` + deferred hash recording until indexing actually succeeds).
- The structural graph now has real edges: language plugins extract call/import references, so hybrid retrieval's graph-expansion step does something instead of degenerating to semantic-only search.
- Deleted files are removed from the graph on re-index; the index no longer indexes its own `.openengraph/graph.db`.
- CLI commands surface clean error messages instead of raw stack traces on predictable failures (not a git repo, plugin not built, database not indexed yet).
- Language plugins correctly distinguish class/struct methods from module-level functions (`kind: 'method'` vs `kind: 'function'`) across all three languages — [#1](https://github.com/chethankumblekar/OpenEngraph/issues/1).
- `git hash-object` failures no longer leak raw stderr past the CLI's clean error path — [#2](https://github.com/chethankumblekar/OpenEngraph/issues/2).
- `searchSimilar`'s top-K tie-break is now deterministic (secondary sort key), so incremental re-indexing and a full clean re-index of the same tree converge to the same query results — [#3](https://github.com/chethankumblekar/OpenEngraph/issues/3).
- Benchmark integrity: the published token-reduction figure is scoped to source code only (excludes this project's own internal planning docs, which had dominated 73–98% of every baseline in an earlier draft), is idempotent (excludes its own output file from the baseline), and records the exact commit + embedding model it was measured against.

### Known limitations (tracked as enterprise-roadmap scope, not bugs)

No multi-repo graph, no cross-system connectors (Slack/Jira/Confluence), no temporal/commit-lineage intelligence, no infrastructure intelligence. See `docs/superpowers/specs/2026-08-02-openengraph-differentiation-design.md` Section 6 and `docs/COMPETITIVE_FEATURE_MATRIX.md` for the full gap analysis against commercial competitors.
