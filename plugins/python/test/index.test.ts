import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('python plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-python',
    language: 'python',
    extensions: ['.py'],
    grammar: 'grammar/tree-sitter-python.wasm'
  });

  it('extracts a top-level function, a class, a method, and imports', async () => {
    const source = `
import os
from typing import Optional

def greet(name):
    return "hi " + name

class Greeter:
    def greet(self, name):
        return greet(name)
`;
    const entities = await plugin.extract(source, 'greet.py');
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'function', name: 'greet' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'method', name: 'greet' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'class', name: 'Greeter' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: 'os' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: 'typing' })
    );

    // Python's grammar gives methods and functions the same node type --
    // the plugin must still tell them apart despite the name collision.
    const methodCount = entities.filter((e) => e.kind === 'method' && e.name === 'greet').length;
    const functionCount = entities.filter((e) => e.kind === 'function' && e.name === 'greet').length;
    expect(methodCount).toBe(1);
    expect(functionCount).toBe(1);
  });

  it('treats a function nested inside a method as a function, not a method', async () => {
    const source = `
class Widget:
    def compute(self):
        def helper():
            return 1
        return helper()
`;
    const entities = await plugin.extract(source, 'widget.py');
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'method', name: 'compute' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'function', name: 'helper' })
    );
  });

  it('records same-file calls and imported-module uses as references', async () => {
    const source = `
import os
import json as j

def greet(name):
    return "hi " + name

def welcome(name):
    os.getcwd()
    j.dumps({})
    return greet(name)
`;
    const entities = await plugin.extract(source, 'greet.py');
    const welcome = entities.find((e) => e.name === 'welcome');
    expect(welcome?.references).toContain('greet');
    expect(welcome?.references).toContain('os');
    expect(welcome?.references).toContain('json');

    const greet = entities.find((e) => e.name === 'greet');
    expect(greet?.references ?? []).toEqual([]);
  });
});
