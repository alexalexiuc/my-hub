/**
 * Copies MapLibre GL's worker (and the shared chunk it imports by relative path)
 * into `public/maplibre/`, where TripMapInner points `setWorkerUrl` at it.
 *
 * MapLibre 6 is ESM-only and resolves its worker from `import.meta.url`, which
 * breaks once Turbopack bundles it into a hashed chunk. This is the setup
 * MapLibre documents for Next.js. It runs before `dev` and `build` so the copy
 * always matches the installed version; the output is gitignored.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dist = path.join(path.dirname(require.resolve('maplibre-gl/package.json')), 'dist');
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'maplibre');

mkdirSync(dest, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
}
