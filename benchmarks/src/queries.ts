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
