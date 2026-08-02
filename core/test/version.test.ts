import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/version.js';

describe('core package', () => {
  it('exports a semver version string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
