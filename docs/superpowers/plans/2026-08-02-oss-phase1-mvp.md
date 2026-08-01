# OpenEngraph OSS Phase 1 MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the OSS Phase 1 MVP from `docs/superpowers/specs/2026-08-02-openengraph-differentiation-design.md` Section 5 — a local-first engineering knowledge graph with hybrid (structural graph + local embeddings) retrieval, exposed via CLI and a local MCP server, with TypeScript/Python/Go language plugins proving the plugin system.

**Architecture:** A repo is parsed by language plugins (tree-sitter WASM grammars) into a structural graph (nodes/edges in SQLite) and a local embedding index (vectors in the same SQLite file, via an in-process ONNX model). A query router answers structural questions from the graph and fuzzy/natural-language questions from the embedding index, combining both when useful. The CLI drives indexing; the server package exposes the router as MCP tools over stdio for any AI assistant to consume.

**Tech Stack:** TypeScript, Node ≥20, npm workspaces, `web-tree-sitter`, `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`), `better-sqlite3`, `@modelcontextprotocol/sdk`, `commander`, `vitest`.

## Global Constraints

- License: Apache-2.0 on `core/`, `cli/`, `server/`, `plugins/*` (design doc Section 4).
- No mandatory external network call at query time. The embedding model downloads once on first run and is cached under `.openengraph/models/`; every query after that is fully offline — no API keys, no per-query network calls.
- Single SQLite file per indexed repo at `.openengraph/graph.db` — no external database server.
- Parsers are `web-tree-sitter` WASM grammars only — no native per-language compilation, so plugin authors never need a build toolchain beyond Node.
- Package naming: internal packages under `@openengraph/*` (`@openengraph/core`, `@openengraph/cli`, `@openengraph/server`); plugins as `@openengraph/plugin-<language>`.
- Every package has its own `package.json`, is ESM (`"type": "module"`), and is covered by `vitest`.
- Deterministic-first routing rule (design doc Section 3) is enforced in code, not left as a convention: the query router must try the graph before falling back to embeddings.

---

## File Structure

```
openengraph/
  package.json                        # npm workspaces root
  tsconfig.base.json
  vitest.config.ts
  LICENSE                             # Apache-2.0
  core/
    package.json
    src/
      storage/schema.ts                # SQLite schema + connection (Task 2)
      storage/db.ts
      index/changeDetector.ts          # git-aware change detection (Task 3)
      plugins/types.ts                 # LanguagePlugin interface (Task 4)
      plugins/loader.ts                # manifest validation + plugin loading (Task 4)
      graph/builder.ts                 # parses files -> graph nodes/edges (Task 6)
      embeddings/index.ts              # chunking + embedding + storage (Task 7)
      embeddings/similarity.ts         # cosine similarity search (Task 7)
      query/router.ts                  # QueryRouter (Task 8)
      query/types.ts
    test/
      storage/schema.test.ts
      index/changeDetector.test.ts
      plugins/loader.test.ts
      graph/builder.test.ts
      embeddings/index.test.ts
      query/router.test.ts
      fixtures/sample-repo/            # tiny multi-language fixture repo (Task 14)
  cli/
    package.json
    src/
      index.ts                         # commander entrypoint
      commands/index.ts                # `openengraph index` (Task 9)
      commands/mcp.ts                  # `openengraph mcp` (Task 11)
    test/
      commands/index.test.ts
      commands/mcp.test.ts
  server/
    package.json
    src/
      mcpServer.ts                     # MCP tool definitions over QueryRouter (Task 10)
    test/
      mcpServer.test.ts
  plugins/
    GOVERNANCE.md                      # manifest schema + review checklist (Task 4)
    typescript/
      package.json
      plugin.json
      grammar/tree-sitter-typescript.wasm
      src/index.ts                     # entity-extraction query (Task 5)
      test/index.test.ts
    python/
      package.json
      plugin.json
      grammar/tree-sitter-python.wasm
      src/index.ts                     # (Task 12)
      test/index.test.ts
    go/
      package.json
      plugin.json
      grammar/tree-sitter-go.wasm
      src/index.ts                     # (Task 13)
      test/index.test.ts
  docs/
    COMPETITIVE_POSITIONING.md          # (Task 15)
  OpenEngraph-Foundation-Spec.md        # edited in place (Task 16)
```

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `core/package.json`, `core/tsconfig.json`, `core/src/version.ts`
- Test: `core/test/version.test.ts`

**Interfaces:**
- Produces: `@openengraph/core` package resolvable via workspace, exporting `VERSION: string` from `core/src/version.ts` — later tasks add to this package.

- [ ] **Step 1: Write the failing smoke test**

`core/test/version.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/version.js';

describe('core package', () => {
  it('exports a semver version string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w core`
Expected: FAIL — `core/src/version.ts` does not exist, or workspace not yet configured.

- [ ] **Step 3: Create the root workspace files**

`package.json`:
```json
{
  "name": "openengraph",
  "private": true,
  "type": "module",
  "workspaces": ["core", "cli", "server", "plugins/*"],
  "scripts": {
    "test": "vitest run",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{core,cli,server,plugins/*}/test/**/*.test.ts']
  }
});
```

`.gitignore`:
```
node_modules/
dist/
.openengraph/
*.wasm.tmp
```

`LICENSE`: copy the standard Apache License 2.0 text verbatim from `https://www.apache.org/licenses/LICENSE-2.0.txt`, with the appended `NOTICE`-style copyright line `Copyright 2026 OpenEngraph Contributors`.

- [ ] **Step 4: Create the `core` package and version export**

`core/package.json`:
```json
{
  "name": "@openengraph/core",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

`core/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "rootDir": "src" }
}
```

`core/src/version.ts`:
```typescript
export const VERSION = '0.1.0';
```

- [ ] **Step 5: Install dependencies and run test to verify it passes**

Run: `npm install && npm test -w core`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json vitest.config.ts .gitignore LICENSE core/
git commit -m "chore: scaffold npm workspaces monorepo with core package"
```

---

### Task 2: Storage Schema

**Files:**
- Create: `core/src/storage/schema.ts`
- Create: `core/src/storage/db.ts`
- Test: `core/test/storage/schema.test.ts`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces:
  - `openDatabase(path: string): Database.Database` from `core/src/storage/db.ts` (re-exports `better-sqlite3`'s `Database` type).
  - `applySchema(db: Database.Database): void` from `core/src/storage/schema.ts`.
  - Tables: `nodes(id TEXT PRIMARY KEY, kind TEXT, name TEXT, file TEXT, start_line INTEGER, end_line INTEGER)`, `edges(id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT, target_id TEXT, kind TEXT)`, `chunks(id TEXT PRIMARY KEY, node_id TEXT, text TEXT, embedding BLOB)`, `files(path TEXT PRIMARY KEY, hash TEXT)`.

- [ ] **Step 1: Write the failing test**

`core/test/storage/schema.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';

describe('applySchema', () => {
  const db = openDatabase(':memory:');
  afterEach(() => db.close());

  it('creates nodes, edges, chunks, and files tables', () => {
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual(expect.arrayContaining(['nodes', 'edges', 'chunks', 'files']));
  });

  it('is idempotent when applied twice', () => {
    expect(() => {
      applySchema(db);
      applySchema(db);
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w core`
Expected: FAIL — `storage/db.js` and `storage/schema.js` not found.

- [ ] **Step 3: Add `better-sqlite3` dependency**

Run: `npm install better-sqlite3 -w core && npm install -D @types/better-sqlite3 -w core`

- [ ] **Step 4: Implement `db.ts` and `schema.ts`**

`core/src/storage/db.ts`:
```typescript
import Database from 'better-sqlite3';

export function openDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  return db;
}
```

`core/src/storage/schema.ts`:
```typescript
import type Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      file TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES nodes(id),
      FOREIGN KEY (target_id) REFERENCES nodes(id)
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB,
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    );

    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
  `);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w core`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core/src/storage core/test/storage core/package.json package-lock.json
git commit -m "feat(core): add SQLite storage schema"
```

---

### Task 3: Change Detector

**Files:**
- Create: `core/src/index/changeDetector.ts`
- Test: `core/test/index/changeDetector.test.ts`

**Interfaces:**
- Consumes: `openDatabase`, `applySchema` from Task 2; `files` table.
- Produces: `detectChangedFiles(repoPath: string, db: Database.Database): { changed: string[]; deleted: string[] }` — compares `git ls-files` + `git hash-object` output against the `files` table, updates the table, and returns which files changed or were deleted since the last run.

- [ ] **Step 1: Write the failing test**

`core/test/index/changeDetector.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import { detectChangedFiles } from '../../src/index/changeDetector.js';

describe('detectChangedFiles', () => {
  let repoPath: string;

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-test-'));
    execSync('git init -q', { cwd: repoPath });
    writeFileSync(join(repoPath, 'a.ts'), 'export const a = 1;');
    execSync('git add a.ts', { cwd: repoPath });
  });

  afterEach(() => rmSync(repoPath, { recursive: true, force: true }));

  it('reports all tracked files as changed on first run', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    const result = detectChangedFiles(repoPath, db);
    expect(result.changed).toEqual(['a.ts']);
    expect(result.deleted).toEqual([]);
  });

  it('reports no changes on a second run with no edits', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    detectChangedFiles(repoPath, db);
    const second = detectChangedFiles(repoPath, db);
    expect(second.changed).toEqual([]);
  });

  it('detects a deleted file', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    detectChangedFiles(repoPath, db);
    rmSync(join(repoPath, 'a.ts'));
    execSync('git add -A', { cwd: repoPath });
    const result = detectChangedFiles(repoPath, db);
    expect(result.deleted).toEqual(['a.ts']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w core`
Expected: FAIL — `index/changeDetector.js` not found.

- [ ] **Step 3: Implement `changeDetector.ts`**

```typescript
import { execFileSync } from 'node:child_process';
import type Database from 'better-sqlite3';

export function detectChangedFiles(
  repoPath: string,
  db: Database.Database
): { changed: string[]; deleted: string[] } {
  const trackedFiles = execFileSync('git', ['ls-files'], { cwd: repoPath, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  const hashOutput = trackedFiles.length
    ? execFileSync('git', ['hash-object', ...trackedFiles], { cwd: repoPath, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
    : [];

  const currentHashes = new Map(trackedFiles.map((file, i) => [file, hashOutput[i]]));

  const previous = db.prepare('SELECT path, hash FROM files').all() as { path: string; hash: string }[];
  const previousHashes = new Map(previous.map((row) => [row.path, row.hash]));

  const changed: string[] = [];
  for (const [file, hash] of currentHashes) {
    if (previousHashes.get(file) !== hash) changed.push(file);
  }

  const deleted: string[] = [];
  for (const file of previousHashes.keys()) {
    if (!currentHashes.has(file)) deleted.push(file);
  }

  const upsert = db.prepare('INSERT INTO files (path, hash) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET hash = excluded.hash');
  const del = db.prepare('DELETE FROM files WHERE path = ?');
  const tx = db.transaction(() => {
    for (const file of changed) upsert.run(file, currentHashes.get(file));
    for (const file of deleted) del.run(file);
  });
  tx();

  return { changed, deleted };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/src/index core/test/index
git commit -m "feat(core): add git-aware change detector"
```

---

### Task 4: Plugin Interface, Loader, Manifest Schema & Governance

**Files:**
- Create: `core/src/plugins/types.ts`
- Create: `core/src/plugins/loader.ts`
- Create: `plugins/GOVERNANCE.md`
- Test: `core/test/plugins/loader.test.ts`

**Interfaces:**
- Produces:
  - `LanguagePlugin` interface (`core/src/plugins/types.ts`):
    ```typescript
    export interface PluginManifest {
      name: string;            // e.g. "@openengraph/plugin-typescript"
      language: string;        // e.g. "typescript"
      extensions: string[];    // e.g. [".ts", ".tsx"]
      grammar: string;         // relative path to .wasm grammar
    }

    export interface ExtractedEntity {
      kind: 'function' | 'class' | 'method' | 'import';
      name: string;
      startLine: number;
      endLine: number;
      references?: string[]; // names this entity calls/imports, for edge building
    }

    export interface LanguagePlugin {
      manifest: PluginManifest;
      extract(sourceCode: string, filePath: string): Promise<ExtractedEntity[]>;
    }
    ```
  - `validateManifest(manifest: unknown): PluginManifest` — throws `Error` with a specific message if a required field is missing or wrong type.
  - `loadPlugin(pluginDir: string): Promise<LanguagePlugin>` — reads `plugin.json`, validates it, dynamically imports `src/index.js` from that dir, and returns the plugin (the imported module must default-export a function `(manifest: PluginManifest) => LanguagePlugin`).

- [ ] **Step 1: Write the failing test**

`core/test/plugins/loader.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateManifest } from '../../src/plugins/loader.js';

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    const manifest = validateManifest({
      name: '@openengraph/plugin-typescript',
      language: 'typescript',
      extensions: ['.ts', '.tsx'],
      grammar: 'grammar/tree-sitter-typescript.wasm'
    });
    expect(manifest.language).toBe('typescript');
  });

  it('rejects a manifest missing "extensions"', () => {
    expect(() =>
      validateManifest({ name: 'x', language: 'x', grammar: 'x.wasm' })
    ).toThrow(/extensions/);
  });

  it('rejects a manifest with non-array "extensions"', () => {
    expect(() =>
      validateManifest({ name: 'x', language: 'x', extensions: '.ts', grammar: 'x.wasm' })
    ).toThrow(/extensions/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w core`
Expected: FAIL — `plugins/loader.js` not found.

- [ ] **Step 3: Implement `types.ts` and `loader.ts`**

`core/src/plugins/types.ts`: (interfaces as specified above)

`core/src/plugins/loader.ts`:
```typescript
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LanguagePlugin, PluginManifest } from './types.js';

export function validateManifest(input: unknown): PluginManifest {
  const m = input as Record<string, unknown>;
  if (typeof m?.name !== 'string') throw new Error('plugin.json: "name" must be a string');
  if (typeof m?.language !== 'string') throw new Error('plugin.json: "language" must be a string');
  if (!Array.isArray(m?.extensions) || !m.extensions.every((e) => typeof e === 'string')) {
    throw new Error('plugin.json: "extensions" must be an array of strings');
  }
  if (typeof m?.grammar !== 'string') throw new Error('plugin.json: "grammar" must be a string');
  return m as unknown as PluginManifest;
}

export async function loadPlugin(pluginDir: string): Promise<LanguagePlugin> {
  const manifestRaw = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8'));
  const manifest = validateManifest(manifestRaw);
  const entryUrl = pathToFileURL(resolve(pluginDir, 'dist', 'index.js')).href;
  const mod = await import(entryUrl);
  const factory = mod.default as (m: PluginManifest) => LanguagePlugin;
  return factory(manifest);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w core`
Expected: PASS

- [ ] **Step 5: Write `plugins/GOVERNANCE.md`**

```markdown
# OpenEngraph Plugin Governance

A plugin is a directory under `plugins/` with:
- `plugin.json` — manifest: `name`, `language`, `extensions` (array), `grammar` (path to a `.wasm` tree-sitter grammar, relative to the plugin directory).
- `src/index.ts` — default-exports a function `(manifest: PluginManifest) => LanguagePlugin` (see `core/src/plugins/types.ts`).
- `test/index.test.ts` — must exercise the plugin against a small fixture source file and assert on the extracted entities.

## Review checklist for new plugin PRs

1. **Grammar provenance**: the `.wasm` grammar must be built from an official/widely-used `tree-sitter-<language>` grammar repo — link the source repo and commit/tag in the PR description.
2. **No native code execution beyond parsing**: `src/index.ts` may only parse `sourceCode` and return `ExtractedEntity[]`. It must not read files, make network calls, or execute subprocesses — reviewers reject any plugin that does.
3. **Test coverage**: at least one fixture file exercising functions, classes/types, and imports for that language, with assertions on the extracted entity list.
4. **Determinism**: given the same source text, `extract()` must return the same entities on every call — no reliance on wall-clock time, randomness, or external state.

Plugins are reviewed and merged into the `plugins/` package by any two OpenEngraph core maintainers.
```

- [ ] **Step 6: Commit**

```bash
git add core/src/plugins core/test/plugins plugins/GOVERNANCE.md
git commit -m "feat(core): add plugin interface, manifest validation, and governance doc"
```

---

### Task 5: TypeScript Language Plugin

**Files:**
- Create: `plugins/typescript/package.json`, `plugins/typescript/plugin.json`
- Create: `plugins/typescript/src/index.ts`
- Create (binary, via `npm install`/postinstall script, see Step 3): `plugins/typescript/grammar/tree-sitter-typescript.wasm`
- Test: `plugins/typescript/test/index.test.ts`

**Interfaces:**
- Consumes: `LanguagePlugin`, `PluginManifest`, `ExtractedEntity` from `@openengraph/core` (Task 4).
- Produces: default export `(manifest: PluginManifest) => LanguagePlugin` for `typescript`/`.ts`/`.tsx`.

- [ ] **Step 1: Write the failing test**

`plugins/typescript/test/index.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w plugins/typescript`
Expected: FAIL — package/plugin does not exist yet.

- [ ] **Step 3: Scaffold the package and fetch the grammar**

`plugins/typescript/package.json`:
```json
{
  "name": "@openengraph/plugin-typescript",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "type": "module",
  "dependencies": {
    "web-tree-sitter": "^0.24.0"
  },
  "scripts": {
    "postinstall": "node scripts/fetch-grammar.mjs"
  }
}
```

`plugins/typescript/plugin.json`:
```json
{
  "name": "@openengraph/plugin-typescript",
  "language": "typescript",
  "extensions": [".ts", ".tsx"],
  "grammar": "grammar/tree-sitter-typescript.wasm"
}
```

Add `plugins/typescript/scripts/fetch-grammar.mjs`, which downloads the prebuilt `tree-sitter-typescript.wasm` from the `tree-sitter-typescript` npm package's published WASM artifact into `grammar/tree-sitter-typescript.wasm` (the `tree-sitter-typescript` npm package ships prebuilt `.wasm` files under its `tree-sitter-typescript.wasm` export — copy it via `node -e "require('node:fs').copyFileSync(require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm'), 'grammar/tree-sitter-typescript.wasm')"` after adding `tree-sitter-typescript` as a devDependency used only by this script).

Run: `npm install -w plugins/typescript` (installs `web-tree-sitter` and runs the postinstall fetch).

- [ ] **Step 4: Implement `src/index.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser, { Language } from 'web-tree-sitter';
import type { ExtractedEntity, LanguagePlugin, PluginManifest } from '@openengraph/core/plugins/types.js';

const pluginDir = dirname(fileURLToPath(import.meta.url));

let languagePromise: Promise<Language> | undefined;
async function getLanguage(grammarPath: string): Promise<Language> {
  if (!languagePromise) {
    languagePromise = Parser.init().then(() => Language.load(join(pluginDir, '..', grammarPath)));
  }
  return languagePromise;
}

export default function createPlugin(manifest: PluginManifest): LanguagePlugin {
  return {
    manifest,
    async extract(sourceCode: string): Promise<ExtractedEntity[]> {
      const language = await getLanguage(manifest.grammar);
      const parser = new Parser();
      parser.setLanguage(language);
      const tree = parser.parse(sourceCode);
      const entities: ExtractedEntity[] = [];

      const query = language.query(`
        (function_declaration name: (identifier) @func.name) @func.decl
        (import_statement source: (string (string_fragment) @import.source))
      `);

      for (const match of query.matches(tree.rootNode)) {
        const funcDecl = match.captures.find((c) => c.name === 'func.decl');
        const funcName = match.captures.find((c) => c.name === 'func.name');
        if (funcDecl && funcName) {
          entities.push({
            kind: 'function',
            name: funcName.node.text,
            startLine: funcDecl.node.startPosition.row + 1,
            endLine: funcDecl.node.endPosition.row + 1
          });
        }
        const importSource = match.captures.find((c) => c.name === 'import.source');
        if (importSource) {
          entities.push({
            kind: 'import',
            name: importSource.node.text,
            startLine: importSource.node.startPosition.row + 1,
            endLine: importSource.node.endPosition.row + 1
          });
        }
      }

      return entities;
    }
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w plugins/typescript`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add plugins/typescript
git commit -m "feat(plugins): add TypeScript language plugin"
```

---

### Task 6: Structural Graph Builder

**Files:**
- Create: `core/src/graph/builder.ts`
- Test: `core/test/graph/builder.test.ts`

**Interfaces:**
- Consumes: `Database` (Task 2), `LanguagePlugin`/`ExtractedEntity` (Task 4), plugin instances (e.g. Task 5's TypeScript plugin) for tests.
- Produces: `buildGraph(db: Database.Database, filePath: string, sourceCode: string, plugin: LanguagePlugin): Promise<void>` — runs `plugin.extract`, writes rows to `nodes` (id = `${filePath}:${kind}:${name}:${startLine}`), and inserts `edges` for any entity with `references` pointing at another node by name within the same file (best-effort same-file linking for Phase 1 — cross-file resolution is enterprise-roadmap scope, noted in code comment referencing design doc Section 6).

- [ ] **Step 1: Write the failing test**

`core/test/graph/builder.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import { buildGraph } from '../../src/graph/builder.js';
import type { LanguagePlugin } from '../../src/plugins/types.js';

const fakePlugin: LanguagePlugin = {
  manifest: { name: 'fake', language: 'fake', extensions: ['.fk'], grammar: 'none' },
  async extract() {
    return [
      { kind: 'function', name: 'greet', startLine: 1, endLine: 3 },
      { kind: 'import', name: 'node:fs', startLine: 0, endLine: 0 }
    ];
  }
};

describe('buildGraph', () => {
  it('inserts one node per extracted entity', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(db, 'greet.ts', 'source', fakePlugin);
    const nodes = db.prepare('SELECT * FROM nodes').all();
    expect(nodes).toHaveLength(2);
  });

  it('is idempotent when the same file is rebuilt', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    await buildGraph(db, 'greet.ts', 'source', fakePlugin);
    await buildGraph(db, 'greet.ts', 'source', fakePlugin);
    const nodes = db.prepare('SELECT * FROM nodes').all();
    expect(nodes).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w core`
Expected: FAIL — `graph/builder.js` not found.

- [ ] **Step 3: Implement `builder.ts`**

```typescript
import type Database from 'better-sqlite3';
import type { LanguagePlugin } from '../plugins/types.js';

export async function buildGraph(
  db: Database.Database,
  filePath: string,
  sourceCode: string,
  plugin: LanguagePlugin
): Promise<void> {
  const entities = await plugin.extract(sourceCode, filePath);

  const deleteExisting = db.prepare('DELETE FROM nodes WHERE file = ?');
  const insertNode = db.prepare(
    'INSERT INTO nodes (id, kind, name, file, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertEdge = db.prepare('INSERT INTO edges (source_id, target_id, kind) VALUES (?, ?, ?)');

  const tx = db.transaction(() => {
    deleteExisting.run(filePath);
    const idByName = new Map<string, string>();

    for (const entity of entities) {
      const id = `${filePath}:${entity.kind}:${entity.name}:${entity.startLine}`;
      insertNode.run(id, entity.kind, entity.name, filePath, entity.startLine, entity.endLine);
      idByName.set(entity.name, id);
    }

    // Same-file reference linking only for Phase 1. Cross-file/cross-repo
    // resolution is enterprise-roadmap scope (design doc Section 6).
    for (const entity of entities) {
      const sourceId = idByName.get(entity.name);
      if (!sourceId || !entity.references) continue;
      for (const ref of entity.references) {
        const targetId = idByName.get(ref);
        if (targetId) insertEdge.run(sourceId, targetId, 'REFERENCES');
      }
    }
  });
  tx();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/src/graph core/test/graph
git commit -m "feat(core): add structural graph builder"
```

---

### Task 7: Local Embedding Index

**Files:**
- Create: `core/src/embeddings/index.ts`
- Create: `core/src/embeddings/similarity.ts`
- Test: `core/test/embeddings/index.test.ts`, `core/test/embeddings/similarity.test.ts`

**Interfaces:**
- Consumes: `Database` (Task 2); `nodes`/`chunks` tables.
- Produces:
  - `embedText(text: string): Promise<Float32Array>` — loads (and caches in-process) the `Xenova/all-MiniLM-L6-v2` pipeline and returns a normalized 384-dim vector.
  - `indexNodeChunks(db: Database.Database, filePath: string, sourceLines: string[]): Promise<void>` — for every `nodes` row belonging to `filePath`, extracts the corresponding source slice, embeds it, and upserts into `chunks` (embedding stored as a `Buffer` via `Float32Array.buffer`).
  - `cosineSimilarity(a: Float32Array, b: Float32Array): number` and `searchSimilar(db: Database.Database, queryVector: Float32Array, topK: number): { nodeId: string; score: number }[]` in `similarity.ts`.

- [ ] **Step 1: Write the failing tests**

`core/test/embeddings/similarity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../../src/embeddings/similarity.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0);
  });
});
```

`core/test/embeddings/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { embedText } from '../../src/embeddings/index.js';

describe('embedText', () => {
  it('returns a 384-dimension normalized vector', async () => {
    const vec = await embedText('function that adds two numbers');
    expect(vec.length).toBe(384);
    const magnitude = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
    expect(magnitude).toBeCloseTo(1, 1);
  }, 30_000); // first call downloads model weights
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w core`
Expected: FAIL — `embeddings/index.js` and `embeddings/similarity.js` not found.

- [ ] **Step 3: Add `@xenova/transformers` dependency**

Run: `npm install @xenova/transformers -w core`

- [ ] **Step 4: Implement `similarity.ts`**

```typescript
import type Database from 'better-sqlite3';

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchSimilar(
  db: Database.Database,
  queryVector: Float32Array,
  topK: number
): { nodeId: string; score: number }[] {
  const rows = db.prepare('SELECT node_id, embedding FROM chunks WHERE embedding IS NOT NULL').all() as {
    node_id: string;
    embedding: Buffer;
  }[];

  const scored = rows.map((row) => ({
    nodeId: row.node_id,
    score: cosineSimilarity(queryVector, new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.length / 4))
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
```

- [ ] **Step 5: Implement `embeddings/index.ts`**

```typescript
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import type Database from 'better-sqlite3';

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return output.data as Float32Array;
}

export async function indexNodeChunks(
  db: Database.Database,
  filePath: string,
  sourceLines: string[]
): Promise<void> {
  const nodes = db.prepare('SELECT id, start_line, end_line FROM nodes WHERE file = ?').all(filePath) as {
    id: string;
    start_line: number;
    end_line: number;
  }[];

  const upsert = db.prepare(
    'INSERT INTO chunks (id, node_id, text, embedding) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text, embedding = excluded.embedding'
  );

  for (const node of nodes) {
    const text = sourceLines.slice(node.start_line - 1, node.end_line).join('\n');
    const vector = await embedText(text);
    upsert.run(`chunk:${node.id}`, node.id, text, Buffer.from(vector.buffer));
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -w core`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core/src/embeddings core/test/embeddings core/package.json package-lock.json
git commit -m "feat(core): add local embedding index and cosine similarity search"
```

---

### Task 8: Query Router

**Files:**
- Create: `core/src/query/types.ts`
- Create: `core/src/query/router.ts`
- Test: `core/test/query/router.test.ts`

**Interfaces:**
- Consumes: `Database` (Task 2), `searchSimilar`/`embedText` (Task 7), `nodes`/`edges` tables (Task 6).
- Produces:
  - `QueryRouter` class with:
    - `structuralQuery(nodeId: string, edgeKind?: string): GraphResult[]` — direct graph lookup, no embeddings.
    - `semanticQuery(text: string, topK?: number): Promise<GraphResult[]>` — embeds `text`, calls `searchSimilar`, resolves node rows.
    - `hybridQuery(text: string, topK?: number): Promise<GraphResult[]>` — runs `semanticQuery` to find seed nodes, then expands each via `structuralQuery` one hop, dedupes, returns combined results. This is the concrete implementation of the design doc Section 3 routing rule ("deterministic first, probabilistic when structure runs out").
  - `GraphResult = { id: string; kind: string; name: string; file: string; startLine: number; endLine: number; via: 'graph' | 'embedding' }`

- [ ] **Step 1: Write the failing test**

`core/test/query/router.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../src/storage/db.js';
import { applySchema } from '../../src/storage/schema.js';
import { QueryRouter } from '../../src/query/router.js';

function seed(db: ReturnType<typeof openDatabase>) {
  db.prepare('INSERT INTO nodes VALUES (?, ?, ?, ?, ?, ?)').run('n1', 'function', 'rateLimit', 'a.ts', 1, 5);
  db.prepare('INSERT INTO nodes VALUES (?, ?, ?, ?, ?, ?)').run('n2', 'function', 'handleRequest', 'a.ts', 7, 12);
  db.prepare('INSERT INTO edges (source_id, target_id, kind) VALUES (?, ?, ?)').run('n2', 'n1', 'REFERENCES');
}

describe('QueryRouter', () => {
  it('structuralQuery returns directly connected nodes without touching embeddings', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    seed(db);
    const router = new QueryRouter(db);
    const results = router.structuralQuery('n2', 'REFERENCES');
    expect(results).toEqual([expect.objectContaining({ id: 'n1', via: 'graph' })]);
  });

  it('structuralQuery returns empty array for a node with no matching edges', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    seed(db);
    const router = new QueryRouter(db);
    expect(router.structuralQuery('n1', 'REFERENCES')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w core`
Expected: FAIL — `query/router.js` not found.

- [ ] **Step 3: Implement `types.ts` and `router.ts`**

`core/src/query/types.ts`:
```typescript
export interface GraphResult {
  id: string;
  kind: string;
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  via: 'graph' | 'embedding';
}
```

`core/src/query/router.ts`:
```typescript
import type Database from 'better-sqlite3';
import { embedText } from '../embeddings/index.js';
import { searchSimilar } from '../embeddings/similarity.js';
import type { GraphResult } from './types.js';

export class QueryRouter {
  constructor(private db: Database.Database) {}

  structuralQuery(nodeId: string, edgeKind?: string): GraphResult[] {
    const sql = edgeKind
      ? 'SELECT n.* FROM edges e JOIN nodes n ON n.id = e.target_id WHERE e.source_id = ? AND e.kind = ?'
      : 'SELECT n.* FROM edges e JOIN nodes n ON n.id = e.target_id WHERE e.source_id = ?';
    const rows = edgeKind
      ? (this.db.prepare(sql).all(nodeId, edgeKind) as any[])
      : (this.db.prepare(sql).all(nodeId) as any[]);
    return rows.map((row) => this.toResult(row, 'graph'));
  }

  async semanticQuery(text: string, topK = 5): Promise<GraphResult[]> {
    const vector = await embedText(text);
    const matches = searchSimilar(this.db, vector, topK);
    return matches
      .map((m) => this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(m.nodeId) as any)
      .filter(Boolean)
      .map((row) => this.toResult(row, 'embedding'));
  }

  async hybridQuery(text: string, topK = 5): Promise<GraphResult[]> {
    const seeds = await this.semanticQuery(text, topK);
    const seen = new Map(seeds.map((s) => [s.id, s]));
    for (const seed of seeds) {
      for (const expanded of this.structuralQuery(seed.id)) {
        if (!seen.has(expanded.id)) seen.set(expanded.id, expanded);
      }
    }
    return [...seen.values()];
  }

  private toResult(row: any, via: 'graph' | 'embedding'): GraphResult {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      file: row.file,
      startLine: row.start_line,
      endLine: row.end_line,
      via
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/src/query core/test/query
git commit -m "feat(core): add QueryRouter with structural, semantic, and hybrid queries"
```

---

### Task 9: CLI `index` Command

**Files:**
- Create: `cli/package.json`, `cli/tsconfig.json`
- Create: `cli/src/index.ts`, `cli/src/commands/index.ts`
- Test: `cli/test/commands/index.test.ts`

**Interfaces:**
- Consumes: `openDatabase`/`applySchema` (Task 2), `detectChangedFiles` (Task 3), `loadPlugin` (Task 4), `buildGraph` (Task 6), `indexNodeChunks` (Task 7), from `@openengraph/core`.
- Produces: `runIndex(repoPath: string, pluginDirs: string[]): Promise<{ filesIndexed: number }>` in `cli/src/commands/index.ts`, wired to `openengraph index <path>` in `cli/src/index.ts`.

- [ ] **Step 1: Write the failing test**

`cli/test/commands/index.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runIndex } from '../../src/commands/index.js';

describe('runIndex', () => {
  let repoPath: string;

  afterEach(() => rmSync(repoPath, { recursive: true, force: true }));

  it('indexes a repo and creates .openengraph/graph.db', async () => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-cli-test-'));
    execSync('git init -q', { cwd: repoPath });
    writeFileSync(join(repoPath, 'a.ts'), 'export function greet() { return 1; }');
    execSync('git add a.ts', { cwd: repoPath });

    const result = await runIndex(repoPath, ['../../plugins/typescript']);

    expect(result.filesIndexed).toBe(1);
    expect(existsSync(join(repoPath, '.openengraph', 'graph.db'))).toBe(true);
  }, 30_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w cli`
Expected: FAIL — `cli` package/command does not exist.

- [ ] **Step 3: Scaffold the `cli` package**

`cli/package.json`:
```json
{
  "name": "@openengraph/cli",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "type": "module",
  "bin": { "openengraph": "dist/index.js" },
  "dependencies": {
    "@openengraph/core": "workspace:*",
    "commander": "^12.0.0"
  }
}
```

`cli/tsconfig.json`: same pattern as `core/tsconfig.json`, extending `../tsconfig.base.json`.

- [ ] **Step 4: Implement `commands/index.ts` and wire the CLI entrypoint**

`cli/src/commands/index.ts`:
```typescript
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { applySchema } from '@openengraph/core/storage/schema.js';
import { detectChangedFiles } from '@openengraph/core/index/changeDetector.js';
import { loadPlugin } from '@openengraph/core/plugins/loader.js';
import { buildGraph } from '@openengraph/core/graph/builder.js';
import { indexNodeChunks } from '@openengraph/core/embeddings/index.js';

export async function runIndex(repoPath: string, pluginDirs: string[]): Promise<{ filesIndexed: number }> {
  mkdirSync(join(repoPath, '.openengraph'), { recursive: true });
  const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
  applySchema(db);

  const plugins = await Promise.all(pluginDirs.map((dir) => loadPlugin(join(repoPath, dir))));
  const { changed } = detectChangedFiles(repoPath, db);

  let filesIndexed = 0;
  for (const file of changed) {
    const plugin = plugins.find((p) => p.manifest.extensions.some((ext) => file.endsWith(ext)));
    if (!plugin) continue;
    const source = readFileSync(join(repoPath, file), 'utf8');
    await buildGraph(db, file, source, plugin);
    await indexNodeChunks(db, file, source.split('\n'));
    filesIndexed++;
  }

  db.close();
  return { filesIndexed };
}
```

`cli/src/index.ts`:
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runIndex } from './commands/index.js';

const program = new Command();
program.name('openengraph').version('0.1.0');

program
  .command('index <path>')
  .description('Index a repository into a local structural + embedding graph')
  .action(async (path: string) => {
    const result = await runIndex(path, []); // plugin resolution wired in Task 12/13 packaging
    console.log(`Indexed ${result.filesIndexed} file(s).`);
  });

program.parse();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w cli`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add cli
git commit -m "feat(cli): add openengraph index command"
```

---

### Task 10: MCP Server

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`
- Create: `server/src/mcpServer.ts`
- Test: `server/test/mcpServer.test.ts`

**Interfaces:**
- Consumes: `QueryRouter` (Task 8), `openDatabase` (Task 2).
- Produces: `createMcpServer(dbPath: string): McpServer` exposing three tools: `graph_query` (wraps `structuralQuery`), `semantic_search` (wraps `semanticQuery`), `hybrid_query` (wraps `hybridQuery`); and `startStdioServer(dbPath: string): Promise<void>` that connects it over `StdioServerTransport`.

- [ ] **Step 1: Write the failing test**

`server/test/mcpServer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { applySchema } from '@openengraph/core/storage/schema.js';
import { createMcpServer } from '../src/mcpServer.js';

describe('createMcpServer', () => {
  it('registers graph_query, semantic_search, and hybrid_query tools', () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    const server = createMcpServer(db);
    const toolNames = server.listTools().map((t) => t.name);
    expect(toolNames).toEqual(
      expect.arrayContaining(['graph_query', 'semantic_search', 'hybrid_query'])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w server`
Expected: FAIL — `server` package/module does not exist.

- [ ] **Step 3: Scaffold the `server` package**

`server/package.json`:
```json
{
  "name": "@openengraph/server",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "type": "module",
  "dependencies": {
    "@openengraph/core": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 4: Implement `mcpServer.ts`**

```typescript
import type Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { QueryRouter } from '@openengraph/core/query/router.js';

export function createMcpServer(db: Database.Database): McpServer {
  const router = new QueryRouter(db);
  const server = new McpServer({ name: 'openengraph', version: '0.1.0' });

  server.tool(
    'graph_query',
    { nodeId: z.string(), edgeKind: z.string().optional() },
    async ({ nodeId, edgeKind }) => ({
      content: [{ type: 'text', text: JSON.stringify(router.structuralQuery(nodeId, edgeKind)) }]
    })
  );

  server.tool('semantic_search', { text: z.string(), topK: z.number().optional() }, async ({ text, topK }) => ({
    content: [{ type: 'text', text: JSON.stringify(await router.semanticQuery(text, topK)) }]
  }));

  server.tool('hybrid_query', { text: z.string(), topK: z.number().optional() }, async ({ text, topK }) => ({
    content: [{ type: 'text', text: JSON.stringify(await router.hybridQuery(text, topK)) }]
  }));

  return server;
}

export async function startStdioServer(db: Database.Database): Promise<void> {
  const server = createMcpServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

*Note: if the installed `@modelcontextprotocol/sdk` version doesn't expose `server.listTools()`, add a thin wrapper in `mcpServer.ts` that tracks registered tool names in a local array as each `server.tool(...)` call is made, and expose that array via a `listRegisteredTools()` export instead — adjust the test import accordingly. Verify against the installed SDK's actual API surface (`node_modules/@modelcontextprotocol/sdk/dist/server/mcp.d.ts`) before finalizing this task.*

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w server`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): add MCP server exposing graph, semantic, and hybrid query tools"
```

---

### Task 11: CLI `mcp` Command

**Files:**
- Create: `cli/src/commands/mcp.ts`
- Modify: `cli/src/index.ts`
- Test: `cli/test/commands/mcp.test.ts`

**Interfaces:**
- Consumes: `startStdioServer` (Task 10), `openDatabase` (Task 2).
- Produces: `runMcp(repoPath: string): Promise<void>` in `cli/src/commands/mcp.ts`, wired to `openengraph mcp <path>`.

- [ ] **Step 1: Write the failing test**

`cli/test/commands/mcp.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { runMcp } from '../../src/commands/mcp.js';
import * as serverModule from '@openengraph/server';

describe('runMcp', () => {
  it('opens the repo database and starts the stdio server', async () => {
    const spy = vi.spyOn(serverModule, 'startStdioServer').mockResolvedValue();
    await runMcp(process.cwd());
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w cli`
Expected: FAIL — `commands/mcp.js` not found.

- [ ] **Step 3: Implement `commands/mcp.ts` and wire it into the CLI**

`cli/src/commands/mcp.ts`:
```typescript
import { join } from 'node:path';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { startStdioServer } from '@openengraph/server';

export async function runMcp(repoPath: string): Promise<void> {
  const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
  await startStdioServer(db);
}
```

Add `@openengraph/server` to `cli/package.json` dependencies, then in `cli/src/index.ts` add:
```typescript
import { runMcp } from './commands/mcp.js';

program
  .command('mcp <path>')
  .description('Start a local MCP server exposing the indexed graph for this repo')
  .action(async (path: string) => {
    await runMcp(path);
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w cli`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli
git commit -m "feat(cli): add openengraph mcp command"
```

---

### Task 12: Python Language Plugin

**Files:**
- Create: `plugins/python/package.json`, `plugins/python/plugin.json`, `plugins/python/scripts/fetch-grammar.mjs`
- Create: `plugins/python/src/index.ts`
- Test: `plugins/python/test/index.test.ts`

**Interfaces:**
- Same shape as Task 5, for `language: "python"`, `extensions: [".py"]`, using `tree-sitter-python`'s prebuilt WASM grammar. Query captures `function_definition name: (identifier) @func.name` and `import_statement`/`import_from_statement` for imports.

- [ ] **Step 1: Write the failing test**

`plugins/python/test/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('python plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-python',
    language: 'python',
    extensions: ['.py'],
    grammar: 'grammar/tree-sitter-python.wasm'
  });

  it('extracts a top-level function and an import', async () => {
    const source = `
import os

def greet(name):
    return "hi " + name
`;
    const entities = await plugin.extract(source, 'greet.py');
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'function', name: 'greet' }));
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'import', name: 'os' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w plugins/python`
Expected: FAIL — package does not exist.

- [ ] **Step 3: Scaffold the package and fetch the grammar**

Follow the same pattern as Task 5 Step 3, substituting `tree-sitter-python` for `tree-sitter-typescript` in `package.json`, `plugin.json`, and `scripts/fetch-grammar.mjs`.

- [ ] **Step 4: Implement `src/index.ts`**

Same structure as the TypeScript plugin (Task 5 Step 4), with the query:
```typescript
const query = language.query(`
  (function_definition name: (identifier) @func.name) @func.decl
  (import_statement name: (dotted_name) @import.source)
  (import_from_statement module_name: (dotted_name) @import.source)
`);
```
and identical capture-to-`ExtractedEntity` mapping logic as Task 5.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w plugins/python`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add plugins/python
git commit -m "feat(plugins): add Python language plugin"
```

---

### Task 13: Go Language Plugin

**Files:**
- Create: `plugins/go/package.json`, `plugins/go/plugin.json`, `plugins/go/scripts/fetch-grammar.mjs`
- Create: `plugins/go/src/index.ts`
- Test: `plugins/go/test/index.test.ts`

**Interfaces:**
- Same shape as Task 5/12, for `language: "go"`, `extensions: [".go"]`, using `tree-sitter-go`'s prebuilt WASM grammar. Query captures `function_declaration name: (identifier) @func.name` and `import_spec path: (interpreted_string_literal) @import.source`.

- [ ] **Step 1: Write the failing test**

`plugins/go/test/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import createPlugin from '../src/index.js';

describe('go plugin', () => {
  const plugin = createPlugin({
    name: '@openengraph/plugin-go',
    language: 'go',
    extensions: ['.go'],
    grammar: 'grammar/tree-sitter-go.wasm'
  });

  it('extracts a top-level function and an import', async () => {
    const source = `
package main

import "fmt"

func Greet(name string) string {
	return "hi " + name
}
`;
    const entities = await plugin.extract(source, 'greet.go');
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'function', name: 'Greet' }));
    expect(entities).toContainEqual(expect.objectContaining({ kind: 'import', name: '"fmt"' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w plugins/go`
Expected: FAIL — package does not exist.

- [ ] **Step 3: Scaffold the package and fetch the grammar**

Follow the same pattern as Task 5 Step 3, substituting `tree-sitter-go`.

- [ ] **Step 4: Implement `src/index.ts`**

Same structure as Task 5/12, with the query:
```typescript
const query = language.query(`
  (function_declaration name: (identifier) @func.name) @func.decl
  (import_spec path: (interpreted_string_literal) @import.source)
`);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w plugins/go`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add plugins/go
git commit -m "feat(plugins): add Go language plugin"
```

---

### Task 14: End-to-End Integration Test

**Files:**
- Create: `core/test/fixtures/sample-repo/` (a tiny fixture repo with one `.ts`, one `.py`, one `.go` file)
- Create: `core/test/integration/e2e.test.ts`

**Interfaces:**
- Consumes: `runIndex` (Task 9), `QueryRouter` (Task 8), all three plugins (Tasks 5, 12, 13).
- Produces: no new production code — this task only proves the full pipeline works end-to-end across all three languages.

- [ ] **Step 1: Create the fixture repo files**

`core/test/fixtures/sample-repo/greet.ts`:
```typescript
export function greet(name: string): string {
  return 'hi ' + name;
}
```

`core/test/fixtures/sample-repo/greet.py`:
```python
def greet(name):
    return "hi " + name
```

`core/test/fixtures/sample-repo/greet.go`:
```go
package main

func Greet(name string) string {
	return "hi " + name
}
```

- [ ] **Step 2: Write the failing integration test**

`core/test/integration/e2e.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runIndex } from '../../../cli/src/commands/index.js';
import { openDatabase } from '../../src/storage/db.js';
import { QueryRouter } from '../../src/query/router.js';

describe('end-to-end indexing and querying', () => {
  let repoPath: string;

  beforeAll(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'oe-e2e-'));
    cpSync(join(__dirname, '..', 'fixtures', 'sample-repo'), repoPath, { recursive: true });
    execSync('git init -q && git add -A', { cwd: repoPath });
  });

  afterAll(() => rmSync(repoPath, { recursive: true, force: true }));

  it('indexes all three languages and answers a hybrid query', async () => {
    const result = await runIndex(repoPath, [
      '../../../plugins/typescript',
      '../../../plugins/python',
      '../../../plugins/go'
    ]);
    expect(result.filesIndexed).toBe(3);

    const db = openDatabase(join(repoPath, '.openengraph', 'graph.db'));
    const router = new QueryRouter(db);
    const results = await router.hybridQuery('function that greets someone by name', 5);
    const names = results.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['greet', 'Greet']));
  }, 60_000);
});
```

- [ ] **Step 3: Run test to verify it fails (or passes if all prior tasks are correctly wired)**

Run: `npm test -w core`
Expected: If Tasks 1-13 are complete and correctly wired, this should PASS on first run — it is a verification task, not new functionality. If it FAILS, the failure identifies an integration bug (e.g. plugin path resolution, manifest mismatch) to fix before proceeding — do not modify the test to make it pass; fix the underlying wiring.

- [ ] **Step 4: Fix any integration issues found, then re-run**

Run: `npm test -w core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/test/fixtures core/test/integration
git commit -m "test: add end-to-end integration test across all three language plugins"
```

---

### Task 15: Competitive Positioning Doc

**Files:**
- Create: `docs/COMPETITIVE_POSITIONING.md`

- [ ] **Step 1: Write the doc**

`docs/COMPETITIVE_POSITIONING.md`:
```markdown
# Competitive Positioning

> Last updated: 2026-08-02. Landscape moves fast — re-verify claims before citing externally.

## Landscape

| Tier | Products | Approach | Scope | Deployment |
|---|---|---|---|---|
| Commercial context engines | Augment Code, Unblocked, Sourcegraph Cody, Greptile | Graph + embeddings hybrid (Augment, Cody), or pure graph (Greptile) | Code, some also aggregate Slack/Jira/Confluence/incidents (Unblocked) or commit lineage (Augment) | SaaS |
| IDE-embedded semantic index | Cursor `@codebase`, Continue, Tabnine | AST-chunked embeddings, vector DB | Code only, per-IDE | SaaS-backed, remote embedding calls |
| Open-source, local-first, MCP-native | CodeGraph, codebase-memory-mcp, GitNexus, code-review-graph | Pure structural graph (tree-sitter) | Code only | 100% local |
| Org-wide service catalogs | Cortex, Backstage, Port, Faros AI | Graph-based service/ownership catalog | Infra + ownership, increasingly AI/MCP-aware | Self-hosted or SaaS |

## The gap OpenEngraph fills

Every sampled open-source, local-first competitor is **pure structural graph** — no semantic/embeddings layer. Every competitor with a semantic layer is **closed-source, SaaS-only, and typically sends code to a remote embeddings API**.

OpenEngraph's OSS core is the first to combine both **and** run the embedding step fully locally (no API key, no per-query network call, no code leaving the machine).

## Why hybrid, why now

A pure structural graph answers "what calls this function" precisely but cannot answer "find the code that handles rate limiting" unless something is literally named that. A pure embeddings index answers fuzzy queries but can't reliably answer precise structural questions ("what depends on this") — it's why every serious commercial player (Cody, Augment, Cursor) already runs both. No OSS local-first tool does yet.

## Explicit non-goal

We are not trying to out-feature Unblocked or Augment on day one — matching their multi-repo, multi-source, org-scale aggregation is enterprise-roadmap scope (see the differentiation design doc, Section 6). Phase 1 wins the OSS layer they do not compete in: a free, local-first, hybrid-retrieval engine for a single repo. The enterprise tier extends upward from that adopted base, rather than trying to compete top-down from day one.
```

- [ ] **Step 2: Commit**

```bash
git add docs/COMPETITIVE_POSITIONING.md
git commit -m "docs: add competitive positioning doc"
```

---

### Task 16: Apply Foundation Spec Edits

**Files:**
- Modify: `OpenEngraph-Foundation-Spec.md`

Per design doc Section 8, apply these four edits exactly:

- [ ] **Step 1: Edit "What OpenEngraph Is Not"**

Find:
```markdown
## What OpenEngraph Is Not

- AI IDE
- Copilot/Claude replacement
- Chat application
- Vector database
- Semantic search product
```

Replace with:
```markdown
## What OpenEngraph Is Not

- AI IDE
- Copilot/Claude replacement
- Chat application
- A vector-DB-only product — embeddings are one input to a routed hybrid retrieval system, not the whole system
```

- [ ] **Step 2: Edit "Core Principles"**

Find:
```markdown
- Deterministic before probabilistic
```

Replace with:
```markdown
- Deterministic first, probabilistic when structure runs out (enforced by the query router — see the differentiation design doc, Section 3)
```

- [ ] **Step 3: Edit "Roadmap"**

Find:
```markdown
## Roadmap

- Phase 1: Indexing + CLI + MCP
- Phase 2: Knowledge Graph
- Phase 3: Infrastructure Intelligence
- Phase 4: Engineering Memory
- Phase 5: Enterprise Collaboration
```

Replace with:
```markdown
## Roadmap

### OSS Roadmap (Phase 1)

- Structural graph (tree-sitter + LSP) + local hybrid embedding index + query router
- CLI + local MCP server, self-hosted, zero mandatory external API dependency
- Flagship language plugins (TypeScript, Python, Go) proving the plugin system

### Enterprise Roadmap (Phases 2-5, post-OSS-traction)

- Phase 2: Multi-repo org knowledge graph
- Phase 3: Infrastructure Intelligence (Kubernetes, Docker, Terraform, etc.)
- Phase 4: Org-scale Temporal/Incident Intelligence + cross-system connectors (Slack, Jira, Confluence, Datadog, Sentry)
- Phase 5: Enterprise Collaboration — hosted service, SSO, multi-agent constitution workflow

See `docs/superpowers/specs/2026-08-02-openengraph-differentiation-design.md` for full rationale.
```

- [ ] **Step 4: Add a "Business Model" section**

Insert after the "Roadmap" section:
```markdown
## Business Model

Open-core. `core/`, `cli/`, `server/`, and `plugins/*` are Apache-2.0 and free. Multi-repo aggregation, cross-system connectors, org-scale temporal intelligence, and enterprise collaboration features live in a separate, closed-contribution `enterprise/` repository. A hosted enterprise offering follows once the OSS tier shows adoption traction — see the differentiation design doc for full reasoning.
```

- [ ] **Step 5: Commit**

```bash
git add OpenEngraph-Foundation-Spec.md
git commit -m "docs: update foundation spec for hybrid retrieval and open-core model"
```

---

## Self-Review Notes

- **Spec coverage**: Section 3 (router) → Task 8; Section 4 (repo/licensing) → Tasks 1, 4; Section 5 (OSS MVP) → Tasks 2-14; Section 6 (enterprise roadmap) → intentionally out of scope, referenced only in Task 16 doc edit; Section 7 (positioning doc) → Task 15; Section 8 (spec edits) → Task 16; Section 9 open questions → resolved concretely in Global Constraints and Task 4 rather than left open.
- **Type consistency checked**: `ExtractedEntity`/`PluginManifest`/`LanguagePlugin` (Task 4) used identically in Tasks 5, 6, 9, 12, 13. `GraphResult` (Task 8) used identically in Task 10. `QueryRouter` method names (`structuralQuery`/`semanticQuery`/`hybridQuery`) match between Task 8's implementation and Task 10's MCP tool wiring.
- **Known risk flagged in-line**: Task 10 includes an explicit note to verify the installed `@modelcontextprotocol/sdk` version's actual tool-listing API before finalizing, since MCP SDK APIs have changed across versions — this is the one spot where the plan asks the implementer to verify against the real installed package rather than assuming an exact signature.
