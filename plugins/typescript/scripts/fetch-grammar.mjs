// Copies the prebuilt tree-sitter-typescript WASM grammar out of the
// `tree-sitter-typescript` devDependency into `grammar/`, so the plugin can
// load it at runtime without shipping a native build step of its own.
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
