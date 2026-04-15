import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'run-task': 'scripts/run-task.ts' },
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
});
