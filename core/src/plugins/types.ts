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
