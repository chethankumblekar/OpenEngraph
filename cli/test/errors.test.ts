import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError, describeError } from '../src/errors.js';

describe('describeError', () => {
  it('prints a CliError message verbatim', () => {
    const message = describeError(new CliError('no index found. Run `openengraph index .` first.'), {
      command: 'mcp'
    });
    expect(message).toBe('openengraph: no index found. Run `openengraph index .` first.');
    expect(message).not.toContain('\n');
  });

  it('explains a real "not a git repository" failure instead of dumping the git error', () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'oe-not-a-repo-'));
    let thrown: unknown;
    try {
      // Guard against a stray parent .git making this a repo after all.
      execFileSync('git', ['--literal-pathspecs', 'ls-files'], {
        cwd: notARepo,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() }
      });
    } catch (error) {
      thrown = error;
    } finally {
      rmSync(notARepo, { recursive: true, force: true });
    }

    expect(thrown).toBeDefined();
    const message = describeError(thrown, { command: 'index', path: '/some/dir' });
    expect(message).toContain('is not a git repository');
    expect(message).toContain('/some/dir');
    expect(message).not.toContain('\n');
  });

  it('explains an unbuilt plugin instead of dumping ERR_MODULE_NOT_FOUND', () => {
    const error = Object.assign(new Error("Cannot find module '/x/dist/index.js'"), {
      code: 'ERR_MODULE_NOT_FOUND'
    });
    const message = describeError(error, { command: 'index' });
    expect(message).toContain('not built');
    expect(message).toContain('npm run build');
  });

  it('explains a missing git binary', () => {
    const error = Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' });
    expect(describeError(error, { command: 'index' })).toContain('Install git');
  });

  it('falls back to a single line for anything unrecognised', () => {
    const error = new Error('something broke\n  at someFrame\n  at anotherFrame');
    const message = describeError(error, { command: 'index' });
    expect(message).toBe('openengraph: index failed: something broke');
  });
});
