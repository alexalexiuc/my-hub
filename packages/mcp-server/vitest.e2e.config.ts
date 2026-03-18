import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // E2e tests are stateful — run files and tests sequentially
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    sequence: { concurrent: false },
    setupFiles: ['e2e/helpers/load-env.ts'],
  },
});
