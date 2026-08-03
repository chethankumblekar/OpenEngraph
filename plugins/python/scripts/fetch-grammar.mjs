// Copies the prebuilt tree-sitter-python WASM grammar out of the
// `tree-sitter-python` devDependency into `grammar/`, so the plugin can
// load it at runtime without shipping a native build step of its own.
//
// Grammar provenance (GOVERNANCE.md rule 1):
//   Upstream grammar repo: https://github.com/tree-sitter/tree-sitter-python
//   Sourced via the `tree-sitter-python` npm package, pinned in
//   plugins/python/package.json as "^0.23.6" and resolved/locked at
//   exactly 0.23.6 in the repo root package-lock.json. That npm release
//   corresponds to the tree-sitter-python upstream tag v0.23.6
//   (https://github.com/tree-sitter/tree-sitter-python/releases/tag/v0.23.6).
//   The .wasm this script copies is the prebuilt artifact shipped inside
//   that exact npm package version — no separate build step is run here.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..');
const grammarDir = join(rootDir, 'grammar');
const dest = join(grammarDir, 'tree-sitter-python.wasm');

const src = require.resolve('tree-sitter-python/tree-sitter-python.wasm');

mkdirSync(grammarDir, { recursive: true });
copyFileSync(src, dest);

console.log(`[fetch-grammar] copied ${src} -> ${dest}`);
