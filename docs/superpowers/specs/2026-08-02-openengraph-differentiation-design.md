# OpenEngraph Differentiation & Retrieval Architecture — Design

> Date: 2026-08-02
> Status: Approved (brainstorm), pending implementation planning
> Supersedes relevant sections of `OpenEngraph-Foundation-Spec.md` (see "Changes to Foundation Spec" below)

## 1. Context

The foundation spec (`OpenEngraph-Foundation-Spec.md`) describes OpenEngraph as a local-first, vendor-neutral engineering knowledge graph that gives AI assistants persistent context instead of re-reading files every session. A competitive scan (2026) found this thesis is validated but the landscape has moved:

- **Commercial context engines** — Augment Code (graph + embeddings hybrid, 400K-file context, "Context Lineage" temporal/commit history, now ships as an MCP server), Unblocked (aggregates code + Slack + Jira + Confluence + incidents, markets itself explicitly on token reduction), Sourcegraph Cody (RAG: embeddings + code graph + reranking), Greptile (full-repo graph for code review).
- **IDE-embedded semantic index** — Cursor's `@codebase` (AST-chunked embeddings, Merkle-tree change detection).
- **Open-source, local-first, MCP-native** — CodeGraph, codebase-memory-mcp, GitNexus, code-review-graph. These already ship close to OpenEngraph's originally-planned Phase 1 MVP (local tree-sitter graph, CLI, MCP server), some benchmarked at 99% token reduction and scaling to the Linux kernel in ~3 minutes.
- **Org-wide service catalogs** — Cortex, Backstage, Port, Faros AI, covering the infra/ownership graph angle, increasingly adding AI/MCP discovery layers.

Key finding: every sampled open-source competitor is **pure structural graph** (calls, imports, class hierarchies) with no semantic/embeddings layer. Every commercial competitor that has embeddings does **not** offer it as local-first/self-hosted OSS.

## 2. Decisions

1. **Goal**: OpenEngraph is a commercial venture (open-core), not purely a portfolio project.
2. **Go-to-market**: sequenced — free/OSS single-repo tool first to build adoption and prove the tech, enterprise tier layered on afterward.
3. **OSS wedge**: hybrid retrieval (structural graph + local embeddings) shipped in the free tier from day one. This is a genuine capability gap against existing OSS competitors, not a manufactured one, and it directly satisfies the need for semantic/fuzzy search without abandoning the "local-first, no forced vector-DB dependency" principle — embeddings are computed and stored locally, not via a mandatory external API.
4. **Open-core boundary**: drawn at *scope*, not at crippling the core engine — single-repo hybrid retrieval is OSS; multi-repo org aggregation, cross-system connectors (Slack/Jira/Confluence/Datadog/Sentry), org-scale temporal/incident lineage, hosted service, and the multi-agent governance workflow are enterprise.

## 3. Retrieval Architecture

```
Repository
 → Change Detector (git-aware, incremental)
 → Parser (tree-sitter + LSP)
 → ┬─ Structural Graph (symbols, calls, imports, deps — deterministic)
   └─ Local Embedding Index (code chunks, docs, ADRs, commit messages)
 → Query Router
 → REST / GraphQL / MCP / CLI
 → Any AI
```

**Query Router** (new component, core to the differentiation):
- Precise structural questions ("what calls this", "what depends on this", "who owns this") resolve via the graph — deterministic, no embeddings involved.
- Fuzzy/natural-language questions ("find the rate-limiting code") fall back to the embedding index.
- Combined mode: embeddings locate a candidate starting node, the graph expands from it (equivalent to Cody's "reranking" step), giving both recall and structural precision.

This reframes the old principle *"deterministic before probabilistic"* as a **routing rule enforced by the query router**, rather than an absolute ban on embeddings. OpenEngraph is not becoming a vector-DB-only product — embeddings are one input to a routed hybrid system.

**Local-first constraint**: the OSS embedding model runs locally (no mandatory external embeddings API call). This is what keeps the "local-first" claim true and is itself a differentiator versus Cursor/Cody, which send code to a remote embeddings service.

## 4. Repository Structure & Licensing

```
openengraph/
  core/           # OSS, Apache-2.0 — parser, structural graph, local embedding index, query router
  cli/            # OSS — single-repo indexing, local MCP server
  server/         # OSS — self-hosted single-repo API (REST/GraphQL/MCP)
  plugins/        # OSS — community-extensible language/infra parsers
  enterprise/     # Separate repo, closed-contribution — multi-repo org graph,
                  #   Slack/Jira/Confluence/Datadog/Sentry connectors, org-scale
                  #   commit/incident lineage, hosted service, SSO, team collaboration,
                  #   multi-agent constitution workflow (Architect/Backend/Reviewer/...)
```

**Why Apache-2.0 for `core`**: maximizes adoption against CodeGraph/GitNexus on their own terms; a copyleft license (AGPL) would deter the individual developers the OSS tier needs to reach critical mass.

**Why a separate repo for `enterprise/` rather than feature-flagging in one repo**: keeps proprietary connector code (Slack/Jira/Datadog integrations, org-scale logic) out of the public source entirely, rather than shipping it publicly but gated at runtime. Cleaner for both security and contributor clarity — community contributors never touch or need to understand enterprise code to work on `core`.

**Contribution model**: `core` and `plugins/` accept community PRs directly. `plugins/` is the primary extensibility surface (new language/infra parsers) so contributors can add value without touching core internals. `enterprise/` is closed-contribution.

## 5. Revised MVP (OSS Phase 1)

The original Phase 1 ("Indexing + CLI + MCP") is now table stakes, not a differentiator, since multiple OSS projects already ship it. Revised scope:

1. Tree-sitter + LSP parser → structural graph (calls/imports/deps) — parity with competitors.
2. **Local embedding index + query router (hybrid retrieval)** — the actual wedge; not present in any sampled OSS competitor.
3. CLI + local MCP server, self-hosted, zero mandatory external API dependency.
4. 2-3 flagship language plugins (e.g., TypeScript, Python, Go) to prove the plugin system works, rather than attempting broad language coverage immediately.

## 6. Enterprise Roadmap (post-OSS-traction)

Former Phases 2-5 from the foundation spec move here, sequenced after Phase 1 (above) proves adoption:

- Multi-repo org knowledge graph
- Infrastructure Intelligence (Kubernetes, Docker, Terraform, etc.)
- Org-scale Temporal/Incident Intelligence (commit lineage, "why did this change", incident correlation)
- Cross-system connectors (Slack, Jira, Confluence, Datadog, Sentry)
- Enterprise Collaboration: hosted service, SSO, multi-agent constitution workflow (Architect/Backend/Frontend/Infrastructure/Reviewer/Test Writer)

## 7. Competitive Positioning (new doc)

A new `docs/COMPETITIVE_POSITIONING.md` should capture:
- The comparison table of commercial, IDE-embedded, OSS, and service-catalog competitors (see Context above).
- The explicit "why hybrid, why now" argument — no sampled OSS competitor combines structural graph with local embeddings.
- An explicit non-goal statement: *"We are not trying to out-feature Unblocked or Augment on day one. We are winning the OSS layer they do not compete in, then extending upward."*

## 8. Changes to `OpenEngraph-Foundation-Spec.md`

- **"What OpenEngraph Is Not"**: remove *"Vector database"* and *"Semantic search product"* as absolute exclusions. Replace with: *"Not a vector-DB-only product — embeddings are one input to a routed hybrid retrieval system, not the whole system."*
- **"Core Principles"**: change *"Deterministic before probabilistic"* to *"Deterministic first, probabilistic when structure runs out"*, enforced by the query router (Section 3 above).
- **"Roadmap"**: split into an OSS roadmap (Section 5 above) and an Enterprise roadmap (Section 6 above), replacing the single undifferentiated 5-phase roadmap.
- **New section**: "Business Model" — open-core; Apache-2.0 `core`; closed, separately-repoed `enterprise/`; hosted enterprise offering follows OSS traction.

## 9. Open Questions / Risks

- **Local embedding model choice** is not yet decided (candidates: a small local sentence-transformer model vs. something purpose-built for code). This is an implementation-planning decision, not a design-level one — deferred to the implementation plan.
- **Plugin governance** (how community-contributed language/infra plugins are reviewed/trusted) is not yet specified — should be addressed before the plugin system ships, not blocking for Phase 1's flagship languages.
- **Enterprise pricing/packaging** is explicitly out of scope for this design — it's a business decision to make once OSS traction data exists, not an architecture decision.
