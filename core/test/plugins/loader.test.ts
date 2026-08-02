import { describe, it, expect } from 'vitest';
import { validateManifest } from '../../src/plugins/loader.js';

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    const manifest = validateManifest({
      name: '@openengraph/plugin-typescript',
      language: 'typescript',
      extensions: ['.ts', '.tsx'],
      grammar: 'grammar/tree-sitter-typescript.wasm'
    });
    expect(manifest.language).toBe('typescript');
  });

  it('rejects a manifest missing "extensions"', () => {
    expect(() =>
      validateManifest({ name: 'x', language: 'x', grammar: 'x.wasm' })
    ).toThrow(/extensions/);
  });

  it('rejects a manifest with non-array "extensions"', () => {
    expect(() =>
      validateManifest({ name: 'x', language: 'x', extensions: '.ts', grammar: 'x.wasm' })
    ).toThrow(/extensions/);
  });
});
