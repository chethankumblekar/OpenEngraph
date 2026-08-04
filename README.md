# OpenEngraph

A local-first engineering knowledge graph: index a repository into a structural graph (tree-sitter) plus a local embedding index, and query it with a hybrid retrieval router — deterministic graph traversal first, semantic search when structure runs out. No code leaves your machine; embeddings run through a local ONNX model, not a remote API.

## Why

AI coding assistants re-read the same files and rebuild the same context every session. OpenEngraph persists that context as a queryable graph instead. On this repository's own codebase, that cuts the token cost of answering real questions by an average of **83.9%** compared to the naive alternative (grep for keywords, read the matching files in full) — see [`benchmarks/RESULTS.md`](benchmarks/RESULTS.md) for the full breakdown and methodology.

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
