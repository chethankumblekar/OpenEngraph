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
5. **Grammar ABI ceiling**: pin the `tree-sitter-<language>` package to a version whose prebuilt `.wasm` targets a tree-sitter ABI that `web-tree-sitter@^0.24.0` can load. Newer grammar releases regularly ship a newer ABI and fail at `Language.load()` — always pin an exact working version rather than tracking latest, and say in the PR why that version was chosen. (Worked example: `plugins/go` pins `tree-sitter-go` at 0.23.4 because 0.25.x exceeds this ceiling — see the comment in `plugins/go/scripts/fetch-grammar.mjs`.)
6. **Resource release**: `extract()` creates a `Parser` and a `Tree` per call, both backed by WASM heap memory that is not garbage-collected. Call `parser.delete()` and `tree.delete()` before returning (a `finally` block, so they run on the error path too). Compiled `Query` objects should be cached alongside the `Language` singleton rather than rebuilt — and therefore leaked — per file.
7. **Reference extraction**: where the grammar makes it practical, populate `references` on each function/class entity with the names it calls, plus the module names of imports it uses. This is what produces the graph's edges; a plugin that only emits nodes reduces hybrid retrieval to plain embedding search. Same-file, name-based linking is the expected scope — cross-file symbol resolution is not.

Plugins are reviewed and merged into the `plugins/` package by any two OpenEngraph core maintainers.
