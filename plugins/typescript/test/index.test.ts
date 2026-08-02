import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('typescript plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-typescript',
    language: 'typescript',
    extensions: ['.ts'],
    grammar: 'grammar/tree-sitter-typescript.wasm'
  });

  it('extracts a top-level function and an import', async () => {
    const source = `
      import { readFileSync } from 'node:fs';

      export function greet(name: string): string {
        return 'hi ' + name;
      }
    `;
    const entities = await plugin.extract(source, 'greet.ts');
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'function', name: 'greet' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: 'node:fs' })
    );
  });
});
