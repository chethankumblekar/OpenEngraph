# Competitive Positioning

> Last updated: 2026-08-02. Landscape moves fast — re-verify claims before citing externally.

## Landscape

| Tier | Products | Approach | Scope | Deployment |
|---|---|---|---|---|
| Commercial context engines | Augment Code, Unblocked, Sourcegraph Cody, Greptile | Graph + embeddings hybrid (Augment, Cody), or pure graph (Greptile) | Code, some also aggregate Slack/Jira/Confluence/incidents (Unblocked) or commit lineage (Augment) | SaaS |
| IDE-embedded semantic index | Cursor `@codebase`, Continue, Tabnine | AST-chunked embeddings, vector DB | Code only, per-IDE | SaaS-backed, remote embedding calls |
| Open-source, local-first, MCP-native | CodeGraph, codebase-memory-mcp, GitNexus, code-review-graph | Pure structural graph (tree-sitter) | Code only | 100% local |
| Org-wide service catalogs | Cortex, Backstage, Port, Faros AI | Graph-based service/ownership catalog | Infra + ownership, increasingly AI/MCP-aware | Self-hosted or SaaS |

## The gap OpenEngraph fills

Every sampled open-source, local-first competitor is **pure structural graph** — no semantic/embeddings layer. Every competitor with a semantic layer is **closed-source, SaaS-only, and typically sends code to a remote embeddings API**.

OpenEngraph's OSS core is the first to combine both **and** run the embedding step fully locally (no API key, no per-query network call, no code leaving the machine).

## Why hybrid, why now

A pure structural graph answers "what calls this function" precisely but cannot answer "find the code that handles rate limiting" unless something is literally named that. A pure embeddings index answers fuzzy queries but can't reliably answer precise structural questions ("what depends on this") — it's why every serious commercial player (Cody, Augment, Cursor) already runs both. No OSS local-first tool does yet.

## Explicit non-goal

We are not trying to out-feature Unblocked or Augment on day one — matching their multi-repo, multi-source, org-scale aggregation is enterprise-roadmap scope (see the differentiation design doc, Section 6). Phase 1 wins the OSS layer they do not compete in: a free, local-first, hybrid-retrieval engine for a single repo. The enterprise tier extends upward from that adopted base, rather than trying to compete top-down from day one.
