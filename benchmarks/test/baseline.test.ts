import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeBaseline } from '../src/baseline.js';

describe('computeBaseline', () => {
  let repoRoot: string;

  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  it('includes only files matching a grep term, counting their full content', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oe-baseline-test-'));
    execSync('git init -q', { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'match.ts'), 'export function embedText() { return 1; }');
    writeFileSync(join(repoRoot, 'nomatch.ts'), 'export function unrelated() { return 2; }');
    execSync('git add -A', { cwd: repoRoot });

    const result = computeBaseline(repoRoot, ['embedText']);

    expect(result.files).toEqual(['match.ts']);
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it('unions files across multiple grep terms without double-counting', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oe-baseline-test-'));
    execSync('git init -q', { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'a.ts'), 'export function alpha() { return 1; }');
    writeFileSync(join(repoRoot, 'b.ts'), 'export function beta() { return 2; }');
    execSync('git add -A', { cwd: repoRoot });

    const result = computeBaseline(repoRoot, ['alpha', 'beta', 'alpha']);

    expect(result.files.sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('returns no files and zero tokens when no term matches', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'oe-baseline-test-'));
    execSync('git init -q', { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'a.ts'), 'export function alpha() { return 1; }');
    execSync('git add -A', { cwd: repoRoot });

    const result = computeBaseline(repoRoot, ['doesNotExistAnywhere']);

    expect(result.files).toEqual([]);
    expect(result.tokenCount).toBe(0);
  });
});
