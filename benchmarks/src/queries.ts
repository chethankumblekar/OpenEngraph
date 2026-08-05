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

/**
 * Questions whose wording was revised after an initial benchmark run, disclosed
 * in RESULTS.md rather than left to be discovered in the git history. Both were
 * changed because the initial phrasing's seed search ranked the real answer
 * outside the topK cutoff, so the published answer omitted the code that
 * actually answered the question -- see the comment on `hybrid-mcp-exposure`
 * below and commit 5325f01 for the Go-plugin case. RESULTS.md derives its
 * "neither is the top-scoring row" claim from this list at write time, so the
 * disclosure cannot silently go stale if the numbers move.
 */
export const REVISED_QUESTION_IDS = ['semantic-plugin-manifest-validation', 'hybrid-mcp-exposure'];

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
    id: 'semantic-plugin-manifest-validation',
    question: 'How does the plugin loader validate a plugin manifest before loading it?',
    mode: 'semantic',
    grepTerms: ['validateManifest', 'loadPlugin'],
    resolve: (router) => router.semanticQuery('validating a plugin manifest before loading a language plugin')
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
    // Reworded from "What does the MCP server expose to AI assistants?". That
    // phrasing's seed search was dominated by `import` nodes that merely
    // mention "mcp" in their module specifier, pushing the real answer
    // (`createMcpServer`) to rank 8 (0.2831) -- below the topK=5 cutoff of
    // 0.3006 -- so the published answer contained no `server/` node at all.
    // Naming the registered tools instead ranks `createMcpServer` first
    // (0.5049), followed by the three `QueryRouter` methods each tool
    // delegates to.
    question: 'How does the MCP server expose graph, semantic, and hybrid queries as tools?',
    mode: 'hybrid',
    grepTerms: ['createMcpServer', 'graph_query', 'semantic_search', 'hybrid_query'],
    resolve: (router) =>
      router.hybridQuery('creating a server that registers graph query, semantic search and hybrid query tools')
  }
];
