#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { runIndex } from './commands/index.js';
import { runMcp } from './commands/mcp.js';
import { resolveInstalledPluginDirs } from './plugins.js';
import { CliError, describeError } from './errors.js';

const program = new Command();
program.name('openengraph').version('0.1.0');

/**
 * commander does not await `.action()` handlers, so a rejected promise from one
 * would surface as an unhandled rejection with a raw stack trace. Wrapping the
 * handler keeps the rejection inside our own catch, where it becomes a single
 * readable line. `process.exitCode` is set rather than calling `process.exit()`
 * so pending cleanup (open database handles, stdio flushes) still runs.
 */
function action<A extends unknown[]>(
  command: string,
  handler: (...args: A) => Promise<void>
): (...args: A) => void {
  return (...args: A) => {
    handler(...args).catch((error: unknown) => {
      const path = typeof args[0] === 'string' ? (args[0] as string) : undefined;
      console.error(describeError(error, { command, path }));
      process.exitCode = 1;
    });
  };
}

program
  .command('index <path>')
  .description('Index a repository into a local structural + embedding graph')
  .action(
    action('index', async (path: string) => {
      if (!existsSync(path)) {
        throw new CliError(`no such directory: "${path}".`);
      }
      const pluginDirs = resolveInstalledPluginDirs();
      if (pluginDirs.length === 0) {
        throw new CliError(
          'no language plugins are installed. Install at least one of @openengraph/plugin-typescript, @openengraph/plugin-python, or @openengraph/plugin-go.'
        );
      }
      const result = await runIndex(path, pluginDirs);
      console.log(
        `Indexed ${result.filesIndexed} file(s)` +
          (result.filesRemoved > 0 ? `, removed ${result.filesRemoved} deleted file(s)` : '') +
          '.'
      );
    })
  );

program
  .command('mcp <path>')
  .description('Start a local MCP server exposing the indexed graph for this repo')
  .action(
    action('mcp', async (path: string) => {
      if (!existsSync(join(path, '.openengraph', 'graph.db'))) {
        throw new CliError(
          `no index found at "${join(path, '.openengraph', 'graph.db')}". Run \`openengraph index ${path}\` first.`
        );
      }
      await runMcp(path);
    })
  );

program.parse();
