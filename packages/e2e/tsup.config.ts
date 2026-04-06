import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'setup-e2e-db': 'scripts/setup-e2e-db.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  bundle: true,
  noExternal: [/./],
  clean: true,
  sourcemap: false,
});
