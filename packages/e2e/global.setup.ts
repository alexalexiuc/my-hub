import { test as setup, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { TEST_USER, BASE_URL } from './config';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

setup('write seeds, create test user and authenticate', async ({ request, page }) => {
  // Register (idempotent — 409 = already exists, that's fine)
  const registerRes = await request.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: TEST_USER.name,
    },
  });
  const status = registerRes.status();
  // 201 = created, 409 = already there. 403 means this instance gates registration behind an
  // invite link, which the endpoint checks *before* it checks whether the user already exists —
  // so a seeded test user gets 403 rather than 409. That is not a failure: the seed script
  // creates the user directly, and the sign-in below is the real assertion either way.
  if (status !== 201 && status !== 409 && status !== 403) {
    const body = await registerRes.text();
    throw new Error(
      `Failed to register test user (status ${status}): ${body}\n` +
        `Make sure ${TEST_USER.email} is in ALLOWED_EMAILS, or seed it first with ` +
        `\`pnpm --filter @my-hub/e2e seed\`.`,
    );
  }
  console.log(`Test user registration response: ${status} ${registerRes.statusText()}`);

  // Sign in via the credentials form
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Should land on the dashboard
  await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 15_000 });

  // Persist auth state (cookies / localStorage) for reuse across tests
  await page.context().storageState({ path: AUTH_FILE });

  // Seed Hub E2E fixtures when running locally (CI seeds via docker compose run e2e-seeds)
  if (process.env.IS_LOCAL === 'true') {
    const seedEnv = { ...process.env, E2E_HUB_USER_EMAIL: TEST_USER.email };
    execSync('npx tsx scripts/setup-e2e-db.ts', {
      cwd: __dirname,
      stdio: 'inherit',
      env: seedEnv,
    });
  }
});
