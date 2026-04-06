import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'setup-e2e-db': 'scripts/setup-e2e-db.ts' },
  format: ['esm'],
  clean: true,
  sourcemap: false,
});
