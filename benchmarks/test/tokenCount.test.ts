import { describe, it, expect } from 'vitest';
import { countTokens } from '../src/tokenCount.js';

describe('countTokens', () => {
  it('returns 0 for empty text', () => {
    expect(countTokens('')).toBe(0);
  });

  it('returns a positive integer for non-empty text', () => {
    expect(countTokens('function greet(name) { return name; }')).toBeGreaterThan(0);
  });

  it('returns a larger count for longer text', () => {
    const short = countTokens('const x = 1;');
    const long = countTokens('const x = 1;\n'.repeat(50));
    expect(long).toBeGreaterThan(short);
  });
});
