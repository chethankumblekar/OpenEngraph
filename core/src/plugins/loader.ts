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
