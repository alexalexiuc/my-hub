import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { BASE_URL } from './config';

export const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // tests share a DB — run sequentially to avoid races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

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
      teardown: 'cleanup',
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
    // 3. Global teardown: cleanup user data via Profile UI
    {
      name: 'cleanup',
      testDir: '.',
      testMatch: /global\.teardown\.ts/,
    },
  ],
});
