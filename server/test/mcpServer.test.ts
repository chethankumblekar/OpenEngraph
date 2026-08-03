import { describe, it, expect } from 'vitest';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { applySchema } from '@openengraph/core/storage/schema.js';
import { createMcpServer } from '../src/mcpServer.js';

describe('createMcpServer', () => {
  it('registers graph_query, semantic_search, and hybrid_query tools', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    const server = createMcpServer(db);
    const toolNames = server.listRegisteredTools().map((t) => t.name);
    expect(toolNames).toEqual(
      expect.arrayContaining(['graph_query', 'semantic_search', 'hybrid_query'])
    );
  });
});
