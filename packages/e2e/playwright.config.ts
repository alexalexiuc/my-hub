import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env['E2E_HUB_BASE_URL'] ?? 'http://localhost:3000';

export const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // tests share a DB — run sequentially to avoid races
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 1. Global setup: register test user + save auth state
    {
      name: 'setup',
      testDir: '.',
      testMatch: /global\.setup\.ts/,
    },
    // 2. All e2e tests — depend on setup, run with pre-saved auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
    },
  ],

  // NOTE: The hub dev server must be running before tests start.
  // Start it with: ALLOWED_EMAILS=e2e-hub@test.local pnpm --filter @my-hub/hub dev
  //
  // For CI, uncomment the webServer block below:
  //
  // webServer: {
  //   command: 'ALLOWED_EMAILS=e2e-hub@test.local pnpm --filter @my-hub/hub dev',
  //   url: `${BASE_URL}/auth/signin`,
  //   reuseExistingServer: false,
  //   timeout: 120_000,
  // },
});
