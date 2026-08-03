import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('python plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-python',
    language: 'python',
    extensions: ['.py'],
    grammar: 'grammar/tree-sitter-python.wasm'
  });

  it('extracts a top-level function, a class, and imports', async () => {
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
      expect.objectContaining({ kind: 'class', name: 'Greeter' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: 'os' })
    );
    expect(entities).toContainEqual(
      expect.objectContaining({ kind: 'import', name: 'typing' })
    );
  });
});
