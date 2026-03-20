import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'src/main.ts',
    'e2e-setup': 'e2e/scripts/setup-e2e-user.ts',
  },
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
});
