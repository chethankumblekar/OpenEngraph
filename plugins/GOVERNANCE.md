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
