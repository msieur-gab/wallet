import { existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mapPath = resolve('node_modules', '@noble', 'curves', 'esm', 'utils.js.map');

if (existsSync(mapPath)) {
  try {
    const stats = statSync(mapPath);
    if (stats.size === 0) {
      writeFileSync(
        mapPath,
        '{"version":3,"sources":[],"names":[],"mappings":"","sourcesContent":[]}',
        'utf8'
      );
      console.log('Patched empty source map for @noble/curves utils');
    }
  } catch (err) {
    console.warn('Unable to patch @noble/curves source map:', err);
  }
}
