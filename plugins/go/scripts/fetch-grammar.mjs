// Copies the prebuilt tree-sitter-go WASM grammar out of the
// `tree-sitter-go` devDependency into `grammar/`, so the plugin can
// load it at runtime without shipping a native build step of its own.
//
// Grammar provenance (GOVERNANCE.md rule 1):
//   Upstream grammar repo: https://github.com/tree-sitter/tree-sitter-go
//   Sourced via the `tree-sitter-go` npm package, pinned in
//   plugins/go/package.json as "^0.23.4" and resolved/locked at
//   exactly 0.23.4 in the repo root package-lock.json. That npm release
//   corresponds to the tree-sitter-go upstream tag v0.23.4
//   (https://github.com/tree-sitter/tree-sitter-go/releases/tag/v0.23.4).
//   The .wasm this script copies is the prebuilt artifact shipped inside
//   that exact npm package version — no separate build step is run here.
//   (Note: newer tree-sitter-go releases (e.g. 0.25.x) are compiled against
//   a tree-sitter ABI newer than what web-tree-sitter@^0.24.0 supports, so
//   0.23.4 is pinned deliberately rather than tracking latest.)
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..');
const grammarDir = join(rootDir, 'grammar');
const dest = join(grammarDir, 'tree-sitter-go.wasm');

const src = require.resolve('tree-sitter-go/tree-sitter-go.wasm');

mkdirSync(grammarDir, { recursive: true });
copyFileSync(src, dest);

console.log(`[fetch-grammar] copied ${src} -> ${dest}`);
