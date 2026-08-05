# Competitive Feature Matrix

> Auto-generated weekly by a scheduled agent. Last updated: 2026-08-06.
> Methodology: each cell is set from a fresh web search that turn, not carried over from memory — competitor products change fast (pricing tiers, MCP support, and self-host options in this space have all shifted within the last few months). Cite the source before changing a cell to ✅ from ❌ or vice versa.
> Legend: ✅ yes / confirmed · 🟡 partial or conditional · ❌ no / not found · `?` not verifiable from public sources this run.

## At a glance

| | Type | Pricing (as of last check) | Primary distribution |
|---|---|---|---|
| **OpenEngraph** | Open-source (Apache-2.0) | Free (OSS core); enterprise tier not yet built | npm, self-hosted |
| Augment Code | Commercial | Credit-based, ~$20-60+/mo/seat | VS Code, JetBrains, Vim/Neovim, CLI, standalone MCP (Feb 2026) |
| Sourcegraph Cody | Commercial | Enterprise-only, $59/user/mo (Free/Pro discontinued Jul 2025) | VS Code, JetBrains |
| Cursor | Commercial | $0 / $20 / $60 / $200 tiers | Is the IDE |
| Greptile | Commercial | $20-30/user/mo + $0.45/req API; self-hosted on Enterprise | GitHub App, MCP (v3) |
| Unblocked | Commercial | From $19/mo | Web, integrations |
| CodeGraph (colbymchenry) | Open-source (MIT) | Free | npm, MCP |
| codebase-memory-mcp (DeusData) | Open-source | Free | npm/PyPI/Homebrew/etc, MCP |
| Cortex / Port / Backstage | Commercial (Backstage: OSS/CNCF) | Enterprise SaaS (Port: $800M valuation, Dec 2025 Series C) | Web platform |

## Feature matrix

| Feature | OpenEngraph | Augment Code | Sourcegraph Cody | Cursor | Greptile | Unblocked | CodeGraph (OSS) | codebase-memory-mcp (OSS) | Cortex/Port/Backstage |
|---|---|---|---|---|---|---|---|---|---|
| Structural code graph (AST/tree-sitter) | ✅ | ✅ | ✅ | 🟡 (pattern/dependency awareness, not a formal graph) | ✅ | 🟡 (context synthesis, not a code graph) | ✅ | ✅ | 🟡 (service/ownership graph, not code-symbol level) |
| Semantic / embedding search | ✅ (local) | ✅ (cloud) | ✅ (cloud) | ✅ (cloud) | 🟡 (implied by "full context," not confirmed as a distinct embedding layer) | ✅ (cloud) | ❌ | ❌ | ❌ |
| Hybrid retrieval (graph + embeddings combined) | ✅ | ✅ | ✅ (RAG + reranking) | 🟡 (unclear if graph-informed) | 🟡 (unconfirmed) | 🟡 (unconfirmed) | ❌ | ❌ | ❌ |
| 100% local embeddings (no API key, no cloud call) | ✅ | ❌ (cloud; local mode via Auggie CLI is partial) | ❌ | ❌ | ❌ | ❌ | N/A (no embeddings) | N/A (no embeddings) | N/A |
| Open source (core) | ✅ Apache-2.0 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ MIT | ✅ | 🟡 Backstage only |
| Self-hostable | ✅ (that's the whole product) | 🟡 (local CLI mode; full engine is cloud) | ✅ (enterprise/BYOC) | ❌ | ✅ (enterprise, air-gapped) | ? | ✅ | ✅ | 🟡 (Backstage yes; Cortex/Port SaaS) |
| MCP server | ✅ (3 tools: graph/semantic/hybrid query) | ✅ (standalone, Feb 2026) | ? | 🟡 (MCP client, not a server) | ✅ (v3) | ? | ✅ | ✅ (15 tools) | 🟡 (Port "AI Builder" orchestrates MCPs, not itself a code-context MCP) |
| Language coverage | 3 (TS, Python, Go) | Broad, count not published | Broad | Any (no parsing layer of its own) | 30+ | N/A (docs/chat, language-agnostic) | 20+ | 158 | N/A |
| Multi-repo / org-wide graph | ❌ (Phase 1 single-repo; enterprise-roadmap item) | ✅ (up to 500K files, dozens of repos) | ✅ (best-in-class per vendor claim) | 🟡 (single active repo focus) | ✅ (enterprise) | ✅ | ❌ | ? | ✅ (core purpose) |
| Cross-system connectors (Slack/Jira/Confluence/CI/etc) | ❌ (enterprise-roadmap item) | 🟡 (Easy MCP: CircleCI, MongoDB, Redis, Sentry, Stripe) | 🟡 (limited) | 🟡 (via MCP ecosystem) | 🟡 (Jira, Notion, Google Docs during review) | ✅ (best-in-class: GitHub/GitLab/Bitbucket/Slack/Jira/Confluence) | ❌ | ❌ | ✅ (CI/CD, cloud resources) |
| Temporal / commit-history intelligence | ❌ (enterprise-roadmap item) | ✅ ("Context Lineage") | 🟡 | ❌ | 🟡 | 🟡 (implicit via decision history) | ❌ | ❌ | 🟡 (scorecards over time) |
| Infrastructure intelligence (K8s/Terraform/etc) | ❌ (enterprise-roadmap item) | ? | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (core purpose) |
| Dedicated IDE integration | ❌ (MCP-only; any MCP client works) | ✅ (VS Code, JetBrains, Vim/Neovim) | ✅ (VS Code, JetBrains) | ✅ (is the IDE) | 🟡 (via MCP) | ? | 🟡 (via MCP) | 🟡 (via MCP) | ❌ |

## Where OpenEngraph is ahead

- **Only entrant that is simultaneously**: open-source, fully local (including the embedding step), *and* hybrid (graph + semantic). Every other hybrid player (Augment, Cody, Cursor, arguably Unblocked) is closed-source and cloud-dependent for the embedding half. Every OSS/local peer (CodeGraph, codebase-memory-mcp) is structural-only.
- Cheapest possible trust story for security-conscious/regulated users who want hybrid retrieval without code ever leaving the machine or a subscription — nobody else currently offers that combination at all, paid or free.

## Where OpenEngraph is behind (by design — enterprise-roadmap scope)

- No multi-repo/org-wide graph (Augment, Cody, Port/Cortex/Backstage all have this).
- No cross-system connectors (Unblocked is the clear leader here: Slack/Jira/Confluence/GitHub/GitLab/Bitbucket).
- No temporal/commit-lineage intelligence (Augment's "Context Lineage" is the direct analog).
- No infrastructure intelligence (Cortex/Port/Backstage's whole reason to exist).
- Narrower language coverage than every graph-based competitor except none — codebase-memory-mcp's 158 languages and CodeGraph's 20+ both exceed OpenEngraph's 3 (TypeScript/Python/Go). This is the most actionable near-term gap: it's OSS-Phase-1 scope, not enterprise-roadmap scope, and existing plugins (Task 5/12/13) already establish the pattern for adding a language.

## Notes on open-source local-first peers specifically

`CodeGraph` and `codebase-memory-mcp` are the two OpenEngraph should track most closely — same tier, same target user, most likely to close the hybrid-retrieval gap first if either adds an embeddings layer. Neither currently advertises one; re-verify this specifically every run, since it's the single fact most likely to erase OpenEngraph's current differentiation.

`codebase-memory-mcp` has a community fork (`win4r/codebase-memory-mcp-pro`) whose stated purpose is "incremental-reindex CALLS-edge fix" — i.e. the same general class of bug as [issue #3](https://github.com/chethankumblekar/OpenEngraph/issues/3) fixed in this repo (incremental re-indexing producing different graph state than a full re-index). Worth reading that fork's fix if it becomes public, as a sanity check against OpenEngraph's own fix.

## Change log

- 2026-08-06: Initial matrix.
