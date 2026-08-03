import type Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { QueryRouter } from '@openengraph/core/query/router.js';

/**
 * The installed `@modelcontextprotocol/sdk` version does not expose a
 * `server.listTools()` method (its registered-tools map is private). This
 * thin wrapper tracks registered tool names locally as each `server.tool(...)`
 * call is made, and exposes them via `listRegisteredTools()`.
 */
export interface OpenEngraphMcpServer {
  server: McpServer;
  listRegisteredTools(): { name: string }[];
}

export function createMcpServer(db: Database.Database): OpenEngraphMcpServer {
  const router = new QueryRouter(db);
  const server = new McpServer({ name: 'openengraph', version: '0.1.0' });
  const toolNames: string[] = [];

  server.tool(
    'graph_query',
    { nodeId: z.string(), edgeKind: z.string().optional() },
    async ({ nodeId, edgeKind }) => ({
      content: [{ type: 'text', text: JSON.stringify(router.structuralQuery(nodeId, edgeKind)) }]
    })
  );
  toolNames.push('graph_query');

  server.tool('semantic_search', { text: z.string(), topK: z.number().optional() }, async ({ text, topK }) => ({
    content: [{ type: 'text', text: JSON.stringify(await router.semanticQuery(text, topK)) }]
  }));
  toolNames.push('semantic_search');

  server.tool('hybrid_query', { text: z.string(), topK: z.number().optional() }, async ({ text, topK }) => ({
    content: [{ type: 'text', text: JSON.stringify(await router.hybridQuery(text, topK)) }]
  }));
  toolNames.push('hybrid_query');

  return {
    server,
    listRegisteredTools: () => toolNames.map((name) => ({ name }))
  };
}

export async function startStdioServer(db: Database.Database): Promise<void> {
  const { server } = createMcpServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
