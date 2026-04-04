import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'setup-e2e-db': 'scripts/setup-e2e-db.ts' },
  format: ['esm'],
  target: 'node22',
  bundle: true,
  noExternal: [/./],
  clean: true,
  sourcemap: false,
});
