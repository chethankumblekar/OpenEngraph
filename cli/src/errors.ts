/**
 * An error whose `message` is already a finished, user-facing sentence.
 * `describeError` prints these verbatim rather than trying to interpret them.
 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

function textOf(error: unknown): string {
  const err = error as { message?: unknown; stderr?: unknown } | null;
  const parts = [
    typeof err?.message === 'string' ? err.message : '',
    typeof err?.stderr === 'string' ? err.stderr : Buffer.isBuffer(err?.stderr) ? err.stderr.toString('utf8') : ''
  ];
  return parts.join('\n');
}

/**
 * Turns an arbitrary thrown value into a single clean line for `console.error`,
 * translating the predictable failure modes into actionable advice instead of
 * leaking a raw stack trace or a `Command failed: git ...` dump.
 */
export function describeError(error: unknown, context: { command: string; path?: string }): string {
  if (error instanceof CliError) return `openengraph: ${error.message}`;

  const code = (error as { code?: unknown } | null)?.code;
  const text = textOf(error);

  if (code === 'ENOENT' && /\bgit\b/.test(text)) {
    return 'openengraph: could not run `git`. Install git and make sure it is on your PATH.';
  }

  if (/not a git repository/i.test(text)) {
    const where = context.path ? `"${context.path}"` : 'that path';
    return `openengraph: ${where} is not a git repository. openengraph uses git to detect which files changed — run \`git init\` there first, or point at a repository.`;
  }

  if (code === 'ERR_MODULE_NOT_FOUND' || /ERR_MODULE_NOT_FOUND/.test(text)) {
    return 'openengraph: a language plugin is installed but not built. Run `npm run build` in the openengraph checkout (plugins are loaded from their compiled dist/ directory).';
  }

  const message = error instanceof Error ? error.message : String(error);
  return `openengraph: ${context.command} failed: ${message.split('\n')[0]}`;
}
