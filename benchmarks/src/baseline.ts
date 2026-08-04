import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countTokens } from './tokenCount.js';

export interface BaselineResult {
  files: string[];
  tokenCount: number;
}

function grepMatchingFiles(repoRoot: string, term: string): string[] {
  try {
    const out = execFileSync('git', ['grep', '-l', '-i', term], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16
    });
    return out.split('\n').filter(Boolean);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) return []; // git grep: no matches, not an error
    throw err;
  }
}

export function computeBaseline(repoRoot: string, grepTerms: string[]): BaselineResult {
  const fileSet = new Set<string>();
  for (const term of grepTerms) {
    for (const file of grepMatchingFiles(repoRoot, term)) {
      fileSet.add(file);
    }
  }

  const files = [...fileSet].sort();
  let tokenCount = 0;
  for (const file of files) {
    tokenCount += countTokens(readFileSync(join(repoRoot, file), 'utf8'));
  }

  return { files, tokenCount };
}
