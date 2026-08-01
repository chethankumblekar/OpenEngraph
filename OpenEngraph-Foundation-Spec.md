# OpenEngraph Project Specification (Foundation)

> Version: 0.1 Draft

## Executive Summary

OpenEngraph is an open-source, vendor-neutral Engineering Intelligence Platform that transforms repositories into persistent engineering knowledge consumable by any AI assistant.

## Mission

Build the missing engineering intelligence layer between repositories and AI.

## Vision

Developer -> AI Assistant -> OpenEngraph -> Engineering Knowledge Graph -> Repository

## What OpenEngraph Is

- Engineering Intelligence Platform
- Persistent Engineering Memory
- Knowledge Graph
- Local-first
- Vendor-neutral
- AI-agnostic
- Incremental
- Plugin-based

## What OpenEngraph Is Not

- AI IDE
- Copilot/Claude replacement
- Chat application
- Vector database
- Semantic search product

## Problem

Current AI assistants repeatedly:

- read the same files
- rebuild context
- forget decisions
- consume unnecessary tokens

OpenEngraph persists engineering knowledge instead.

## Core Principles

- Deterministic before probabilistic
- Knowledge over context
- Graph first
- Local first
- AI agnostic
- Incremental indexing
- Extensible architecture

## High-Level Architecture

```
Repository
→ Change Detector
→ Incremental Parser
→ Symbol Graph + Semantic Index + Metadata
→ Engineering Knowledge Graph
→ REST / GraphQL / MCP / CLI
→ Any AI
```

## Core Components

### Repository Intelligence

- Tree-sitter parsing
- LSP integration
- Symbol extraction
- Dependency graph

### Knowledge Graph

**Nodes:**
Repository, Module, Class, Method, API, Deployment, ADR, Incident, Runbook, Commit, PR, Issue

**Edges:**
CALLS, IMPLEMENTS, DEPENDS_ON, FIXES, DOCUMENTS, DEPLOYED_BY, ALERTS, TESTS, OWNS

### Infrastructure Intelligence

Supports Kubernetes, Docker, Terraform, Bicep, Helm, GitHub Actions, Azure DevOps, Azure, AWS, GCP.

### Temporal Intelligence

Tracks architecture evolution and answers:

- Why did this change?
- Which release introduced it?
- Which incident influenced it?

### Multi-Agent Model

Architect → Backend → Frontend → Infrastructure → Reviewer → Test Writer

Every agent reads:

- CONTEXT.md
- CONSTITUTION.md
- Relevant subsystem documentation

## AI Guardrails

Never build an IDE.
Never couple to one model.
Always preserve engineering knowledge.

## Roadmap

- Phase 1: Indexing + CLI + MCP
- Phase 2: Knowledge Graph
- Phase 3: Infrastructure Intelligence
- Phase 4: Engineering Memory
- Phase 5: Enterprise Collaboration

## Repository Layout

```
.github/
docs/
core/
graph/
parser/
storage/
plugins/
cli/
server/
```

## Long-Term Vision

Knowledge belongs to the repository—not the model.
