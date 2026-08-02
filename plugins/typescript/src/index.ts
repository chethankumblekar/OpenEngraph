import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'web-tree-sitter';
import type { ExtractedEntity, LanguagePlugin, PluginManifest } from '@openengraph/core/plugins/types.js';

const pluginDir = dirname(fileURLToPath(import.meta.url));

let languagePromise: Promise<Parser.Language> | undefined;
async function getLanguage(grammarPath: string): Promise<Parser.Language> {
  if (!languagePromise) {
    languagePromise = Parser.init().then(() => Parser.Language.load(join(pluginDir, '..', grammarPath)));
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
      if (!tree) return entities;

      const query = language.query(`
        (function_declaration name: (identifier) @func.name) @func.decl
        (class_declaration name: (type_identifier) @class.name) @class.decl
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
        const classDecl = match.captures.find((c) => c.name === 'class.decl');
        const className = match.captures.find((c) => c.name === 'class.name');
        if (classDecl && className) {
          entities.push({
            kind: 'class',
            name: className.node.text,
            startLine: classDecl.node.startPosition.row + 1,
            endLine: classDecl.node.endPosition.row + 1
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
