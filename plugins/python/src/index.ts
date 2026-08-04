import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'web-tree-sitter';
import type { ExtractedEntity, LanguagePlugin, PluginManifest } from '@openengraph/core/plugins/types.js';

const pluginDir = dirname(fileURLToPath(import.meta.url));

// Verified against node_modules/tree-sitter-python/grammar.js: the call node is
// `call` (not `call_expression`) with a `function` field; attribute access is
// `attribute` with `object` / `attribute` fields; `import_statement` carries one
// or more `name` fields that are either a `dotted_name` or an `aliased_import`.
const QUERY_SOURCE = `
  (function_definition name: (identifier) @func.name) @func.decl
  (class_definition name: (identifier) @class.name) @class.decl
  (import_statement name: (dotted_name) @import.source) @import.stmt
  (import_statement name: (aliased_import name: (dotted_name) @import.source)) @import.stmt
  (import_from_statement module_name: (dotted_name) @import.source) @import.stmt
  (call function: (identifier) @call.name)
  (call
    function: (attribute
      object: (identifier) @call.object
      attribute: (identifier) @call.name))
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
        const seenImports = new Set<string>();

        for (const match of query.matches(tree.rootNode)) {
          const funcDecl = match.captures.find((c) => c.name === 'func.decl');
          const funcName = match.captures.find((c) => c.name === 'func.name');
          if (funcDecl && funcName) {
            const entity: ExtractedEntity = {
              kind: isMethodOfClass(funcDecl.node) ? 'method' : 'function',
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

          const importSource = match.captures.find((c) => c.name === 'import.source');
          const importStmt = match.captures.find((c) => c.name === 'import.stmt');
          if (importSource) {
            const key = `${importSource.node.startIndex}:${importSource.node.text}`;
            if (!seenImports.has(key)) {
              seenImports.add(key);
              entities.push({
                kind: 'import',
                name: importSource.node.text,
                startLine: importSource.node.startPosition.row + 1,
                endLine: importSource.node.endPosition.row + 1
              });
            }
            if (importStmt) collectImportBindings(importStmt.node, importBindings);
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
 * Python's grammar has no distinct node for a class method — `def` inside a
 * class body produces the same `function_definition` node as a top-level
 * `def`. Distinguish them by walking up from the function to whichever comes
 * first: a `class_definition` (it's a method) or another `function_definition`
 * (it's a nested/closure function inside a function body, not a method, even
 * if that outer function is itself a method).
 */
function isMethodOfClass(funcDefNode: Parser.SyntaxNode): boolean {
  let current = funcDefNode.parent;
  while (current) {
    if (current.type === 'function_definition') return false;
    if (current.type === 'class_definition') return true;
    current = current.parent;
  }
  return false;
}

/**
 * Maps each local name an import statement binds to the module it came from:
 * `import os.path` binds `os`; `import numpy as np` binds `np` -> `numpy`;
 * `from typing import Optional` binds `Optional` -> `typing`.
 */
function collectImportBindings(stmt: Parser.SyntaxNode, into: Map<string, string>): void {
  const moduleName = stmt.childForFieldName('module_name');

  for (const name of stmt.childrenForFieldName('name')) {
    if (name.type === 'aliased_import') {
      const alias = name.childForFieldName('alias');
      const target = name.childForFieldName('name');
      if (alias && target) into.set(alias.text, moduleName ? moduleName.text : target.text);
      continue;
    }
    if (name.type !== 'dotted_name') continue;
    if (moduleName) {
      // `from <module> import <name>` — the bound name points at the module.
      into.set(name.text, moduleName.text);
    } else {
      // `import a.b.c` binds only the leading segment, but the extracted import
      // node is named for the full dotted path.
      const head = name.namedChildren[0];
      if (head) into.set(head.text, name.text);
    }
  }
}

/**
 * Attributes every call site to the innermost enclosing definition and records
 * the callee on that definition's `references`. Names either resolve to an
 * imported module or are left for `buildGraph` to match against another entity
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
