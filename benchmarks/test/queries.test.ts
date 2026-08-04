import { describe, it, expect } from 'vitest';
import { BENCHMARK_QUESTIONS } from '../src/queries.js';

describe('BENCHMARK_QUESTIONS', () => {
  it('has exactly 8 questions with unique ids', () => {
    expect(BENCHMARK_QUESTIONS).toHaveLength(8);
    const ids = new Set(BENCHMARK_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(8);
  });

  it('covers all three retrieval modes', () => {
    const modes = new Set(BENCHMARK_QUESTIONS.map((q) => q.mode));
    expect(modes).toEqual(new Set(['structural', 'semantic', 'hybrid']));
  });

  it('gives every question at least one grep term', () => {
    for (const q of BENCHMARK_QUESTIONS) {
      expect(q.grepTerms.length).toBeGreaterThan(0);
    }
  });
});
