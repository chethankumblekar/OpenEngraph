import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('go plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-go',
    language: 'go',
    extensions: ['.go'],
    grammar: 'grammar/tree-sitter-go.wasm'
  });

  it('extracts a top-level function, a struct type, a method, and an import', async () => {
    const source = `
package main

import "fmt"

type Greeter struct {
	Name string
}

func Greet(name string) string {
	return "hi " + name
}

func (g *Greeter) Greet() string {
	return Greet(g.Name)
}
`;
    const entities = await plugin.extract(source, 'greet.go');
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'function', name: 'Greet' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'method', name: 'Greet' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'class', name: 'Greeter' })
    );
    // Import names are unquoted, matching the bare form the TypeScript and
    // Python plugins produce (`node:fs`, `os`).
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: 'fmt' })
    );

    // The receiver method and the top-level function share a name but not a
    // kind -- Go's method_declaration is a distinct node from
    // function_declaration, so this must not conflate them.
    const methodCount = entities.filter((e) => e.kind === 'method' && e.name === 'Greet').length;
    const functionCount = entities.filter((e) => e.kind === 'function' && e.name === 'Greet').length;
    expect(methodCount).toBe(1);
    expect(functionCount).toBe(1);
  });

  it('attributes a call made inside a method to the method, not left unattributed', async () => {
    const source = `
package main

func helper() int {
	return 1
}

type Widget struct{}

func (w *Widget) Compute() int {
	return helper()
}
`;
    const entities = await plugin.extract(source, 'widget.go');
    const compute = entities.find((e) => e.kind === 'method' && e.name === 'Compute');
    expect(compute?.references).toContain('helper');
  });

  it('records same-file calls and imported-package uses as references', async () => {
    const source = `
package main

import "fmt"

func Greet(name string) string {
	return "hi " + name
}

func Welcome(name string) string {
	fmt.Println(Greet(name))
	return Greet(name)
}
`;
    const entities = await plugin.extract(source, 'greet.go');
    const welcome = entities.find((e) => e.name === 'Welcome');
    expect(welcome?.references).toContain('Greet');
    expect(welcome?.references).toContain('fmt');

    const greet = entities.find((e) => e.kind === 'function' && e.name === 'Greet');
    expect(greet?.references ?? []).toEqual([]);
  });
});
