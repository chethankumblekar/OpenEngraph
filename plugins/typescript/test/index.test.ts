import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('typescript plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-typescript',
    language: 'typescript',
    extensions: ['.ts'],
    grammar: 'grammar/tree-sitter-typescript.wasm'
  });

  it('extracts a top-level function, a class, and an import', async () => {
    const source = `
      import { readFileSync } from 'node:fs';

      export function greet(name: string): string {
        return 'hi ' + name;
      }

      export class Greeter {
        greet(name: string): string {
          return greet(name);
        }
      }
    `;
    const entities = await plugin.extract(source, 'greet.ts');
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'function', name: 'greet' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'class', name: 'Greeter' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: 'node:fs' })
    );
  });

  it('records same-file function calls as references on the calling function', async () => {
    const source = `
      export function greet(name: string): string {
        return 'hi ' + name;
      }

      export function welcome(name: string): string {
        return greet(name) + '!';
      }
    `;
    const entities = await plugin.extract(source, 'greet.ts');
    const welcome = entities.find((e) => e.name === 'welcome');
    expect(welcome?.references).toContain('greet');

    // The callee itself calls nothing in this file.
    const greet = entities.find((e) => e.kind === 'function' && e.name === 'greet');
    expect(greet?.references ?? []).not.toContain('welcome');
  });

  it('resolves a call through an imported binding to the module it came from', async () => {
    const source = `
      import { readFileSync } from 'node:fs';
      import * as path from 'node:path';

      export function load(file: string): string {
        return readFileSync(path.resolve(file), 'utf8');
      }
    `;
    const entities = await plugin.extract(source, 'load.ts');
    const load = entities.find((e) => e.name === 'load');
    expect(load?.references).toContain('node:fs');
    expect(load?.references).toContain('node:path');
  });

  it('attributes a call to the innermost enclosing declaration', async () => {
    const source = `
      export function outer(): number {
        function inner(): number {
          return helper();
        }
        return inner();
      }

      export function helper(): number {
        return 1;
      }
    `;
    const entities = await plugin.extract(source, 'nested.ts');
    const inner = entities.find((e) => e.name === 'inner');
    const outer = entities.find((e) => e.name === 'outer');
    expect(inner?.references).toContain('helper');
    expect(outer?.references).toEqual(['inner']);
  });
});
