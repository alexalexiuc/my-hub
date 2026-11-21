import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { TZ: 'UTC' },
    // Integration tests share one Postgres database; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
