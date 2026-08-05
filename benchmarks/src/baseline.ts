import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countTokens } from './tokenCount.js';

export interface BaselineResult {
  files: string[];
  tokenCount: number;
}

/**
 * Pathspecs excluded from the baseline corpus.
 *
 * The baseline simulates a developer (or naive agent) grepping the *source* of
 * an unfamiliar repository. Two kinds of file are excluded:
 *
 * - Prose Markdown (`:!docs`, `:!*.md`) -- this repository's own design docs,
 *   plans and specs. Including them made 73-98% of every baseline row consist
 *   of internal planning prose rather than code, which inflated the measured
 *   reduction without reflecting anything an agent would actually need to read
 *   to answer these questions.
 * - The benchmark package itself (`:!benchmarks`) -- `benchmarks/RESULTS.md` is
 *   git-tracked and contains every grep term used here, so without this the
 *   baseline would grow on each run by re-reading the previous run's published
 *   output, making the numbers non-idempotent and unreproducible.
 *
 * Both exclusions only ever shrink the baseline, i.e. they make the published
 * reduction smaller, never larger.
 */
export const BASELINE_EXCLUDED_PATHSPECS = [':!docs', ':!*.md', ':!benchmarks'];

function grepMatchingFiles(repoRoot: string, term: string, excludePathspecs: string[]): string[] {
  try {
    const out = execFileSync('git', ['grep', '-l', '-i', term, '--', '.', ...excludePathspecs], {
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

function computeBaselineWithExclusions(repoRoot: string, grepTerms: string[], excludePathspecs: string[]): BaselineResult {
  const fileSet = new Set<string>();
  for (const term of grepTerms) {
    for (const file of grepMatchingFiles(repoRoot, term, excludePathspecs)) {
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

/** The published baseline: source only, per `BASELINE_EXCLUDED_PATHSPECS`. */
export function computeBaseline(repoRoot: string, grepTerms: string[]): BaselineResult {
  return computeBaselineWithExclusions(repoRoot, grepTerms, BASELINE_EXCLUDED_PATHSPECS);
}

/**
 * The same baseline with no exclusions applied — used only to measure, at
 * run time, how much the exclusions actually shrink the baseline (see the
 * "Baseline corpus" disclosure in `run.ts`). Never published as a result
 * row itself; a live comparison point so that disclosure can't go stale the
 * way a hardcoded "~Nx" figure would as the corpus grows.
 */
export function computeUnfilteredBaseline(repoRoot: string, grepTerms: string[]): BaselineResult {
  return computeBaselineWithExclusions(repoRoot, grepTerms, []);
}
