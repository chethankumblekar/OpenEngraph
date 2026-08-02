import { describe, it, expect } from 'vitest';
import { embedText } from '../../src/embeddings/index.js';

describe('embedText', () => {
  it('returns a 384-dimension normalized vector', async () => {
    const vec = await embedText('function that adds two numbers');
    expect(vec.length).toBe(384);
    const magnitude = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
    expect(magnitude).toBeCloseTo(1, 1);
  }, 30_000); // first call downloads model weights
});
