# Competitive Feature Matrix

> Auto-generated weekly by a scheduled agent. Last updated: 2026-10-19.
> Methodology: each cell is set from a fresh web search that turn, not carried over from memory — competitor products change fast (pricing tiers, MCP support, and self-host options in this space have all shifted within the last few months). Cite the source before changing a cell to ✅ from ❌ or vice versa.
> Legend: ✅ yes / confirmed · 🟡 partial or conditional · ❌ no / not found · `?` not verifiable from public sources this run.

## At a glance

| | Type | Pricing (as of last check) | Primary distribution |
|---|---|---|---|
| **OpenEngraph** | Open-source (Apache-2.0) | Free (OSS core); enterprise tier not yet built | npm, self-hosted |
| Augment Code | Commercial | Credit-based, ~$20-60+/mo/seat | VS Code, JetBrains, Vim/Neovim, CLI, standalone MCP (Feb 2026) |
| Sourcegraph Cody | Commercial | Enterprise-only, $59/user/mo (Free/Pro discontinued Jul 2025) | VS Code, JetBrains |
| Cursor | Commercial | Hobby free / Pro $20 / Pro+ $60 / Ultra $200 / Teams $40/user / Enterprise custom (6 tiers, credit-based) | Is the IDE |
| Greptile | Commercial | $30/user/mo (cut from $50, May 2026) + $1/review past 50/seat; free Starter tier added Jul 2026 (50 credits/mo); self-hosted on Enterprise | GitHub App, MCP (v3) |
| Unblocked | Commercial | Code Review $19/mo, Platform $29/mo, Enterprise undisclosed | Web, integrations |
| CodeGraph (colbymchenry) | Open-source (MIT) | Free | npm, MCP |
| codebase-memory-mcp (DeusData) | Open-source (MIT) | Free | npm/PyPI/Homebrew/etc, MCP |
| Cortex / Port / Backstage | Commercial (Backstage: OSS/CNCF) | Enterprise SaaS (Port: $800M valuation, Dec 2025 Series C) | Web platform |
| LocalNest MCP (wmt-mobile) | Open-source (MIT) | Free | npm, MCP |

## Feature matrix

| Feature | OpenEngraph | Augment Code | Sourcegraph Cody | Cursor | Greptile | Unblocked | CodeGraph (OSS) | codebase-memory-mcp (OSS) | Cortex/Port/Backstage | LocalNest MCP (OSS) |
|---|---|---|---|---|---|---|---|---|---|---|
| Structural code graph (AST/tree-sitter) | ✅ | ✅ | ✅ | 🟡 (pattern/dependency awareness, not a formal graph) | ✅ | 🟡 (context synthesis, not a code graph) | ✅ | ✅ | 🟡 (service/ownership graph, not code-symbol level) | ✅ (AST-aware chunking, symbol defs/usages/callers) |
| Semantic / embedding search | ✅ (local) | ✅ (cloud) | ✅ (cloud) | ✅ (cloud) | 🟡 (implied by "full context," not confirmed as a distinct embedding layer) | ✅ (cloud) | 🟡 (marketed as "semantic search / finds code by meaning"; local vs. cloud and exact mechanism unconfirmed from a primary source — re-verify) | ✅ (local; bundled Nomic `nomic-embed-code` embeddings, int8-quantized, compiled into the binary — no API key, no network call) | ❌ | ✅ (local `all-MiniLM-L6-v2`, no GPU needed) |
| Hybrid retrieval (graph + embeddings combined) | ✅ | ✅ | ✅ (RAG + reranking) | 🟡 (unclear if graph-informed) | 🟡 (unconfirmed) | 🟡 (unconfirmed) | 🟡 (unconfirmed whether its "semantic search" is graph-informed) | ✅ (`semantic_query` alongside the structural graph tools) | ❌ | ✅ (hybrid BM25 + vector, fused via RRF, plus symbol graph) |
| 100% local embeddings (no API key, no cloud call) | ✅ | ❌ (cloud; local mode via Auggie CLI is partial) | ❌ | ❌ | ❌ | ❌ | ? (unconfirmed) | ✅ (bundled model, no API/network call) | N/A | ✅ |
| Open source (core) | ✅ Apache-2.0 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ MIT | ✅ MIT | 🟡 Backstage only | ✅ MIT |
| Self-hostable | ✅ (that's the whole product) | 🟡 (local CLI mode; full engine is cloud) | ✅ (enterprise/BYOC) | ❌ | ✅ (enterprise, air-gapped) | ? | ✅ | ✅ | 🟡 (Backstage yes; Cortex/Port SaaS) | ✅ (that's the whole product) |
| MCP server | ✅ (3 tools: graph/semantic/hybrid query) | ✅ (standalone, Feb 2026) | ? | 🟡 (MCP client, not a server) | ✅ (v3) | ? | ✅ | ✅ (14 tools — corrected from 15, multiple sources now agree on 14) | 🟡 (Port "AI Builder" orchestrates MCPs, not itself a code-context MCP) | ✅ (74 tools) |
| Language coverage | 3 (TS, Python, Go) | Broad, count not published | Broad | Any (no parsing layer of its own) | 30+ | N/A (docs/chat, language-agnostic) | 20+ core (Rust kernel); one source claims 34+ incl. ArkTS/COBOL/Terraform — sources disagree, treat the higher number as unverified | 158 | N/A | ? (not stated in README; AST-aware chunking, coverage unconfirmed) |
| Multi-repo / org-wide graph | ❌ (Phase 1 single-repo; enterprise-roadmap item) | ✅ (up to 500K files, dozens of repos) | ✅ (best-in-class per vendor claim) | 🟡 (single active repo focus) | ✅ (enterprise) | ✅ | ❌ | ? | ✅ (core purpose) | ? (not confirmed; appears single-workspace like its peers) |
| Cross-system connectors (Slack/Jira/Confluence/CI/etc) | ❌ (enterprise-roadmap item) | 🟡 (Easy MCP: CircleCI, MongoDB, Redis, Sentry, Stripe) | 🟡 (limited) | 🟡 (via MCP ecosystem) | 🟡 (Jira, Notion, Google Docs during review) | ✅ (best-in-class: GitHub/GitLab/Bitbucket/Slack/Jira/Confluence) | ❌ | ❌ | ✅ (CI/CD, cloud resources) | ❌ |
| Temporal / commit-history intelligence | ❌ (enterprise-roadmap item) | ✅ ("Context Lineage") | 🟡 | ❌ | 🟡 | 🟡 (implicit via decision history) | ❌ | ❌ | 🟡 (scorecards over time) | ✅ (temporal entity-triple store; multi-hop traversal + `as_of` time-travel queries) |
| Infrastructure intelligence (K8s/Terraform/etc) | ❌ (enterprise-roadmap item) | ? | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (core purpose) | ❌ |
| Dedicated IDE integration | ❌ (MCP-only; any MCP client works) | ✅ (VS Code, JetBrains, Vim/Neovim) | ✅ (VS Code, JetBrains) | ✅ (is the IDE) | 🟡 (via MCP) | ? | 🟡 (via MCP) | 🟡 (via MCP) | ❌ | 🟡 (via MCP) |

## Where OpenEngraph is ahead

> ⚠️ **The core "only OSS + local + hybrid" claim below no longer clearly holds as of 2026-10-19** — see the Change Log entry for this date and the Notes section below. Flagging for human strategic review rather than quietly dropping or overstating it.

- Previously: **only entrant that is simultaneously** open-source, fully local (including the embedding step), *and* hybrid (graph + semantic). This is no longer uniquely true — `codebase-memory-mcp` now ships local embeddings (bundled, no API key) and `LocalNest MCP` (new entrant, see below) ships local hybrid retrieval *and* temporal intelligence. Every closed-source hybrid player (Augment, Cody, Cursor, arguably Unblocked) is still cloud-dependent for the embedding half, so OpenEngraph's local-only framing still holds *against the commercial tier* — just not against its nearest OSS peers anymore.
- What plausibly still differentiates OpenEngraph within the OSS/local tier: a graph-first query *router* (structural query resolves deterministically via the graph; only falls back to embeddings when structure runs out) rather than a flat BM25+vector fusion. Whether this is a meaningfully better retrieval architecture than LocalNest's RRF fusion, or just a different one, is an open question this job cannot verify from web research alone — worth a human/product call, not a matrix cell.
- Cheapest possible trust story for security-conscious/regulated users remains true in absolute terms (nobody pays a subscription or sends code off-machine), but it is now shared by at least two OSS peers rather than being unique to OpenEngraph.

## Where OpenEngraph is behind (by design — enterprise-roadmap scope)

- No multi-repo/org-wide graph (Augment, Cody, Port/Cortex/Backstage all have this).
- No cross-system connectors (Unblocked is the clear leader here: Slack/Jira/Confluence/GitHub/GitLab/Bitbucket).
- No temporal/commit-lineage intelligence (Augment's "Context Lineage" is the direct commercial analog) — **and now also behind an OSS peer on this**: LocalNest MCP already ships a temporal entity-triple store with `as_of` time-travel queries, fully local. This narrows the "enterprise-roadmap, not urgent" framing for this specific item — a peer at OpenEngraph's own price point (free) already has it.
- No infrastructure intelligence (Cortex/Port/Backstage's whole reason to exist).
- Narrower language coverage than every graph-based OSS competitor — codebase-memory-mcp's 158 languages and CodeGraph's 20-34+ (sources disagree on the higher figure) both exceed OpenEngraph's 3 (TypeScript/Python/Go). This is the most actionable near-term gap: it's OSS-Phase-1 scope, not enterprise-roadmap scope, and existing plugins already establish the pattern for adding a language.

## Notes on open-source local-first peers specifically

`CodeGraph`, `codebase-memory-mcp`, and now `LocalNest MCP` are the peers OpenEngraph should track most closely — same tier, same target user. As of this run:
- `codebase-memory-mcp` **has added local embeddings** (bundled `nomic-embed-code`, int8-quantized, compiled into the binary, no API key) — it is no longer structural-only.
- `LocalNest MCP` (`wmt-mobile/localnest`, npm `localnest-mcp`) is a **new entrant** this run: local hybrid BM25+vector code search via `all-MiniLM-L6-v2` embeddings (the same model family OpenEngraph uses) plus a temporal knowledge graph with time-travel queries, MIT-licensed, 74 MCP tools, no cloud dependency. It is the single most direct threat surfaced this run — it already ships both the hybrid-retrieval wedge and the temporal capability OpenEngraph treats as a future gap.
- `CodeGraph` is now also *marketed* as doing "semantic search," though the mechanism (local embeddings vs. something else) isn't confirmed from a primary source yet — re-verify next run before treating this as settled.

`codebase-memory-mcp`'s community fork `win4r/codebase-memory-mcp-pro` (stated purpose: "incremental-reindex CALLS-edge fix," the same class of bug as [issue #3](https://github.com/chethankumblekar/OpenEngraph/issues/3) fixed in this repo) still could not be found publicly as of this run. Re-check next run.

## Change log

- 2026-10-19: OpenEngraph's own feature set re-verified unchanged (README.md, `core/src/plugins/types.ts`, `plugins/` dir, `docs/superpowers/specs|plans/*.md`): still 3 languages (TS/Python/Go), 3 MCP tools, no enterprise-roadmap item built yet. Competitor changes found, all re-verified fresh this run: **(1) `codebase-memory-mcp` added local semantic/embedding search** — bundled `nomic-embed-code` embeddings (int8-quantized, compiled into the binary, no API key/network call); updated its Semantic search, Hybrid retrieval, and 100% local embeddings cells from ❌/N/A to ✅, and corrected its MCP tool count 15→14 (multiple independent third-party write-ups now agree on 14). Sources: dev.to/andrew-ooo "codebase-memory-mcp review," instagit.com technical summaries (secondhand but mutually consistent on the bundled-model architecture). **⚠️ Strategic flag: this erodes the "no OSS peer has an embeddings layer" half of OpenEngraph's differentiation claim.** **(2) New entrant added: LocalNest MCP** (`wmt-mobile/localnest`, npm `localnest-mcp`, MIT) — ships local hybrid BM25+vector search (via local `all-MiniLM-L6-v2` embeddings, the same model family OpenEngraph uses) plus AST-aware symbol lookup *and* a temporal knowledge graph with `as_of` time-travel queries, 74 MCP tools, zero cloud dependency. Source: npm package README via jsdelivr CDN (cdn.jsdelivr.net/npm/localnest-mcp@0.3.2/README.md). **⚠️ Strategic flag: this is the most direct threat found this run — it already ships both OpenEngraph's hybrid-retrieval wedge and the temporal-intelligence capability OpenEngraph lists as a not-yet-built enterprise-roadmap item, for free, OSS, local.** As a result, rewrote "Where OpenEngraph is ahead" and "Notes on open-source local-first peers" to stop asserting uniqueness that no longer holds — flagging for a human strategic read rather than deciding a response here. **(3)** CodeGraph (colbymchenry) is now marketed by third parties as offering "semantic search... finds code by meaning" (everydev.ai, vibeindex.ai) — upgraded its Semantic search and Hybrid retrieval cells from ❌ to 🟡 (mechanism/local-vs-cloud unconfirmed from a primary source; re-verify next run); its language-count claims now range from 20 (Rust-kernel core) to a disputed 34+ (one source adds ArkTS/COBOL/Terraform/etc.) — noted both, did not pick one. **(4)** Pricing refreshed with sourced changes: Cursor is now documented as 6 tiers (Hobby free / Pro $20 / Pro+ $60 / Ultra $200 / Teams $40-seat / Enterprise custom) per jetadmin.io/mem0.ai/dev.to; Greptile moved to a credit-based model (50 reviews/seat then $1/review since Mar 2026) with a new free Starter tier (50 credits/mo, added Jul 2026) and its per-seat price cut to $30/mo (from $50, May 2026), self-hosting still Enterprise-only, per costbench.com changelog entries; Unblocked now documented as two named tiers, Code Review $19/mo and Platform $29/mo, Enterprise undisclosed, per pricingsaas.com. **(5)** Checked but left unchanged, sourcing too conflicting to act on: Augment Code's tier structure (one review claims Indie/Standard/Max were retired in Mar 2026 leaving only Business/Enterprise; other aggregators still show the old 4-tier structure — re-verify against Augment's own pricing page next run); Sourcegraph Cody (aggregators reference a Jul 2026 "plan removed" event but disagree on the resulting price — existing $59/user/mo enterprise-only cell is consistent with the most detailed source found, left as-is). **(6)** No updates found for Cortex/Port/Backstage this run (search did not surface pricing or MCP-specific changes) or for the `win4r/codebase-memory-mcp-pro` fork (still not found publicly) — both left as-is.
- 2026-08-06: Initial matrix.
