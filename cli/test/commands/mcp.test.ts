import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMcp } from '../../src/commands/mcp.js';
import * as serverModule from '@openengraph/server';

describe('runMcp', () => {
  let testRepoPath: string;

  afterEach(() => {
    rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('opens the repo database and starts the stdio server', async () => {
    testRepoPath = mkdtempSync(join(tmpdir(), 'oe-mcp-test-'));
    mkdirSync(join(testRepoPath, '.openengraph'), { recursive: true });

    const spy = vi.spyOn(serverModule, 'startStdioServer').mockResolvedValue();
    await runMcp(testRepoPath);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
