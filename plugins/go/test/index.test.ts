import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('go plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-go',
    language: 'go',
    extensions: ['.go'],
    grammar: 'grammar/tree-sitter-go.wasm'
  });

  it('extracts a top-level function, a struct type, and an import', async () => {
    const source = `
package main

import "fmt"

type Greeter struct {
	Name string
}

func Greet(name string) string {
	return "hi " + name
}
`;
    const entities = await plugin.extract(source, 'greet.go');
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'function', name: 'Greet' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'class', name: 'Greeter' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: '"fmt"' })
    );
  });
});
