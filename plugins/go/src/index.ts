import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'web-tree-sitter';
import type { ExtractedEntity, LanguagePlugin, PluginManifest } from '@openengraph/core/plugins/types.js';

const pluginDir = dirname(fileURLToPath(import.meta.url));

// Verified against plugins/go/node_modules/tree-sitter-go/grammar.js (the
// pinned 0.23.4 grammar this plugin's WASM is built from): calls are
// `call_expression` with a `function` field; qualified calls go through
// `selector_expression` with `operand` / `field` fields; `import_spec` has an
// optional `name` alias field plus the quoted `path`.
const QUERY_SOURCE = `
  (function_declaration name: (identifier) @func.name) @func.decl
  (method_declaration name: (field_identifier) @method.name) @method.decl
  (type_declaration (type_spec name: (type_identifier) @class.name type: (struct_type)) @class.decl)
  (import_spec path: (interpreted_string_literal) @import.source) @import.spec
  (call_expression function: (identifier) @call.name)
  (call_expression
    function: (selector_expression
      operand: (identifier) @call.object
      field: (field_identifier) @call.name))
`;

let languagePromise: Promise<Parser.Language> | undefined;
async function getLanguage(grammarPath: string): Promise<Parser.Language> {
  if (!languagePromise) {
    languagePromise = Parser.init().then(() => Parser.Language.load(join(pluginDir, '..', grammarPath)));
  }
  return languagePromise;
}

// Cached alongside the process-lifetime Language singleton instead of being
// recompiled (and leaked) for every file parsed.
let cachedQuery: Parser.Query | undefined;
function getQuery(language: Parser.Language): Parser.Query {
  if (!cachedQuery) cachedQuery = language.query(QUERY_SOURCE);
  return cachedQuery;
}

interface Scope {
  entity: ExtractedEntity;
  startIndex: number;
  endIndex: number;
}

/**
 * `interpreted_string_literal` node text keeps its surrounding quotes. Strip
 * them so Go import names read as `fmt` / `net/http`, matching the bare form
 * the TypeScript and Python plugins produce.
 */
function unquote(literal: string): string {
  return literal.replace(/^["`]/, '').replace(/["`]$/, '');
}

export default function createPlugin(manifest: PluginManifest): LanguagePlugin {
  return {
    manifest,
    async extract(sourceCode: string): Promise<ExtractedEntity[]> {
      const language = await getLanguage(manifest.grammar);
      const parser = new Parser();
      const entities: ExtractedEntity[] = [];
      let tree: Parser.Tree | undefined;

      try {
        parser.setLanguage(language);
        tree = parser.parse(sourceCode);
        if (!tree) return entities;

        const query = getQuery(language);
        const scopes: Scope[] = [];
        const importBindings = new Map<string, string>();
        const calls: { name: string; object?: string; index: number }[] = [];

        for (const match of query.matches(tree.rootNode)) {
          const funcDecl = match.captures.find((c) => c.name === 'func.decl');
          const funcName = match.captures.find((c) => c.name === 'func.name');
          if (funcDecl && funcName) {
            const entity: ExtractedEntity = {
              kind: 'function',
              name: funcName.node.text,
              startLine: funcDecl.node.startPosition.row + 1,
              endLine: funcDecl.node.endPosition.row + 1
            };
            entities.push(entity);
            scopes.push({
              entity,
              startIndex: funcDecl.node.startIndex,
              endIndex: funcDecl.node.endIndex
            });
          }

          const methodDecl = match.captures.find((c) => c.name === 'method.decl');
          const methodName = match.captures.find((c) => c.name === 'method.name');
          if (methodDecl && methodName) {
            const entity: ExtractedEntity = {
              kind: 'method',
              name: methodName.node.text,
              startLine: methodDecl.node.startPosition.row + 1,
              endLine: methodDecl.node.endPosition.row + 1
            };
            entities.push(entity);
            scopes.push({
              entity,
              startIndex: methodDecl.node.startIndex,
              endIndex: methodDecl.node.endIndex
            });
          }

          const classDecl = match.captures.find((c) => c.name === 'class.decl');
          const className = match.captures.find((c) => c.name === 'class.name');
          if (classDecl && className) {
            const entity: ExtractedEntity = {
              kind: 'class',
              name: className.node.text,
              startLine: classDecl.node.startPosition.row + 1,
              endLine: classDecl.node.endPosition.row + 1
            };
            entities.push(entity);
            scopes.push({
              entity,
              startIndex: classDecl.node.startIndex,
              endIndex: classDecl.node.endIndex
            });
          }

          const importSource = match.captures.find((c) => c.name === 'import.source');
          const importSpec = match.captures.find((c) => c.name === 'import.spec');
          if (importSource) {
            const importPath = unquote(importSource.node.text);
            entities.push({
              kind: 'import',
              name: importPath,
              startLine: importSource.node.startPosition.row + 1,
              endLine: importSource.node.endPosition.row + 1
            });
            // Without an explicit alias, Go binds the last path segment:
            // `import "net/http"` is referenced as `http`.
            const alias = importSpec?.node.childForFieldName('name');
            const binding = alias && alias.text !== '.' && alias.text !== '_'
              ? alias.text
              : importPath.split('/').pop();
            if (binding) importBindings.set(binding, importPath);
          }

          const callName = match.captures.find((c) => c.name === 'call.name');
          if (callName) {
            const callObject = match.captures.find((c) => c.name === 'call.object');
            calls.push({
              name: callName.node.text,
              object: callObject?.node.text,
              index: callName.node.startIndex
            });
          }
        }

        attachReferences(scopes, calls, importBindings);
        return entities;
      } finally {
        tree?.delete();
        parser.delete();
      }
    }
  };
}

/**
 * Attributes every call site to the innermost enclosing declaration and records
 * the callee on that declaration's `references`. Names either resolve to an
 * imported package or are left for `buildGraph` to match against another entity
 * in the same file; anything else is dropped there. Same-file, best-effort
 * linking is the deliberate Phase 1 scope (design doc Section 6).
 */
function attachReferences(
  scopes: Scope[],
  calls: { name: string; object?: string; index: number }[],
  importBindings: Map<string, string>
): void {
  const refsByEntity = new Map<ExtractedEntity, Set<string>>();

  for (const call of calls) {
    let innermost: Scope | undefined;
    for (const scope of scopes) {
      if (call.index < scope.startIndex || call.index >= scope.endIndex) continue;
      if (!innermost || scope.endIndex - scope.startIndex < innermost.endIndex - innermost.startIndex) {
        innermost = scope;
      }
    }
    if (!innermost) continue;

    const viaReceiver = call.object ? importBindings.get(call.object) : undefined;
    const target = viaReceiver ?? importBindings.get(call.name) ?? call.name;
    let refs = refsByEntity.get(innermost.entity);
    if (!refs) {
      refs = new Set<string>();
      refsByEntity.set(innermost.entity, refs);
    }
    refs.add(target);
  }

  for (const [entity, refs] of refsByEntity) {
    entity.references = [...refs];
  }
}
