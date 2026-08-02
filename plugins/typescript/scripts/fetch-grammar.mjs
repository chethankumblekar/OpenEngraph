// Copies the prebuilt tree-sitter-typescript WASM grammar out of the
// `tree-sitter-typescript` devDependency into `grammar/`, so the plugin can
// load it at runtime without shipping a native build step of its own.
//
// Grammar provenance (GOVERNANCE.md rule 1):
//   Upstream grammar repo: https://github.com/tree-sitter/tree-sitter-typescript
//   Sourced via the `tree-sitter-typescript` npm package, pinned in
//   plugins/typescript/package.json as "^0.23.2" and resolved/locked at
//   exactly 0.23.2 in the repo root package-lock.json. That npm release
//   corresponds to the tree-sitter-typescript upstream tag v0.23.2
//   (https://github.com/tree-sitter/tree-sitter-typescript/releases/tag/v0.23.2).
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
const dest = join(grammarDir, 'tree-sitter-typescript.wasm');

const src = require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm');

mkdirSync(grammarDir, { recursive: true });
copyFileSync(src, dest);

console.log(`[fetch-grammar] copied ${src} -> ${dest}`);
