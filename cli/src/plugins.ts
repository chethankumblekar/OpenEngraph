import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

// Every flagship plugin package this CLI knows about. Tasks 12 and 13 add
// @openengraph/plugin-python and @openengraph/plugin-go as explicit cli
// dependencies once those packages exist — until then, resolution below
// simply skips whichever of these aren't installed yet, so this file does
// not need to change again when those tasks land.
const KNOWN_PLUGIN_PACKAGES = [
  '@openengraph/plugin-typescript',
  '@openengraph/plugin-python',
  '@openengraph/plugin-go'
];

export function resolveInstalledPluginDirs(): string[] {
  const dirs: string[] = [];
  for (const pkg of KNOWN_PLUGIN_PACKAGES) {
    try {
      dirs.push(dirname(require.resolve(`${pkg}/package.json`)));
    } catch {
      // Not installed yet (e.g. python/go plugins before Tasks 12/13) — skip.
    }
  }
  return dirs;
}
