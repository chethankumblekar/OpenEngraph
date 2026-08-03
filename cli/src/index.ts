#!/usr/bin/env node
import { Command } from 'commander';
import { runIndex } from './commands/index.js';
import { runMcp } from './commands/mcp.js';
import { resolveInstalledPluginDirs } from './plugins.js';

const program = new Command();
program.name('openengraph').version('0.1.0');

program
  .command('index <path>')
  .description('Index a repository into a local structural + embedding graph')
  .action(async (path: string) => {
    const result = await runIndex(path, resolveInstalledPluginDirs());
    console.log(`Indexed ${result.filesIndexed} file(s).`);
  });

program
  .command('mcp <path>')
  .description('Start a local MCP server exposing the indexed graph for this repo')
  .action(async (path: string) => {
    await runMcp(path);
  });

program.parse();
