import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'web-tree-sitter';
import type { ExtractedEntity, LanguagePlugin, PluginManifest } from '@openengraph/core/plugins/types.js';

const pluginDir = dirname(fileURLToPath(import.meta.url));

// Verified against node_modules/tree-sitter-javascript/grammar.js (which
// tree-sitter-typescript extends): `call_expression` has a `function` field
// that is an arbitrary expression; the two forms worth resolving by name are a
// bare `identifier` (`greet()`) and a `member_expression` whose `property` is a
// `property_identifier` (`obj.greet()` / `fs.readFileSync()`).
const QUERY_SOURCE = `
  (function_declaration name: (identifier) @func.name) @func.decl
  (class_declaration name: (type_identifier) @class.name) @class.decl
  (method_definition name: (property_identifier) @method.name) @method.decl
  (import_statement source: (string (string_fragment) @import.source)) @import.stmt
  (call_expression function: (identifier) @call.name)
  (call_expression
    function: (member_expression
      object: (identifier) @call.object
      property: (property_identifier) @call.name))
  (call_expression function: (member_expression property: (property_identifier) @call.name))
`;

let languagePromise: Promise<Parser.Language> | undefined;
async function getLanguage(grammarPath: string): Promise<Parser.Language> {
  if (!languagePromise) {
    languagePromise = Parser.init().then(() => Parser.Language.load(join(pluginDir, '..', grammarPath)));
  }
  return languagePromise;
}

// A tree-sitter Query is tied to the Language, which is a process-lifetime
// singleton here, so the compiled query is cached with it rather than being
// rebuilt (and leaked) for every file parsed.
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

        // Declarations that can own references (functions and classes), with
        // their byte ranges so calls can be attributed to the innermost one.
        const scopes: Scope[] = [];
        // Local binding name -> module specifier, e.g. readFileSync -> node:fs.
        const importBindings = new Map<string, string>();
        // Call sites: callee name, the receiver for `obj.fn()` calls, and where
        // the call appears.
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

          const importSource = match.captures.find((c) => c.name === 'import.source');
          const importStmt = match.captures.find((c) => c.name === 'import.stmt');
          if (importSource) {
            const moduleName = importSource.node.text;
            entities.push({
              kind: 'import',
              name: moduleName,
              startLine: importSource.node.startPosition.row + 1,
              endLine: importSource.node.endPosition.row + 1
            });
            if (importStmt) {
              for (const binding of importedBindings(importStmt.node)) {
                importBindings.set(binding, moduleName);
              }
            }
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
 * Local names introduced by an `import_statement`: the default binding, a
 * `* as ns` namespace binding, and each `{ a, b as c }` specifier (the alias
 * when present, since that is the name used at call sites).
 */
function importedBindings(importStmt: Parser.SyntaxNode): string[] {
  const names: string[] = [];
  const clause = importStmt.namedChildren.find((c) => c.type === 'import_clause');
  if (!clause) return names;

  for (const child of clause.namedChildren) {
    if (child.type === 'identifier') {
      names.push(child.text); // default import
    } else if (child.type === 'namespace_import') {
      const alias = child.namedChildren.find((c) => c.type === 'identifier');
      if (alias) names.push(alias.text);
    } else if (child.type === 'named_imports') {
      for (const spec of child.namedChildren) {
        if (spec.type !== 'import_specifier') continue;
        const alias = spec.childForFieldName('alias');
        const name = spec.childForFieldName('name');
        const bound = alias ?? name;
        if (bound) names.push(bound.text);
      }
    }
  }
  return names;
}

/**
 * Attributes every call site to the innermost enclosing declaration and records
 * the callee on that declaration's `references`.
 *
 * Names are matched textually: a call is either resolved to an imported module
 * (so the caller gets an edge to that `import` node) or left as-is for
 * `buildGraph` to match against another entity in the same file. Names that
 * resolve to neither are dropped there. This is the deliberate Phase 1 scope —
 * same-file, best-effort linking; real cross-file symbol resolution is
 * enterprise-roadmap work (design doc Section 6). One known consequence is that
 * `obj.greet()` still resolves by bare name, so it can match an unrelated
 * same-file `function greet()` as readily as the intended `Obj.prototype.greet`
 * method — kind alone (`'method'` vs `'function'`) narrows this but doesn't
 * eliminate it without real type information.
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

    // `path.resolve()` is a use of the `path` binding, so a namespace import
    // resolves through the receiver; `readFileSync()` resolves through the
    // callee name itself.
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
