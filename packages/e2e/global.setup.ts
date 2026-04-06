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
  if (status !== 201 && status !== 409) {
    const body = await registerRes.text();
    throw new Error(
      `Failed to register test user (status ${status}): ${body}\n` +
        `Make sure ${TEST_USER.email} is in ALLOWED_EMAILS (or ALLOWED_EMAILS is empty).`,
    );
  } else {
    console.log(`Test user registration response: ${status} ${registerRes.statusText()}`);
  }

  // Sign in via the credentials form
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Should land on the dashboard
  await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 15_000 });

  // Persist auth state (cookies / localStorage) for reuse across tests
  await page.context().storageState({ path: AUTH_FILE });

  // Seed Hub E2E fixtures when running locally (CI seeds via docker compose exec hub)
  if (process.env['IS_LOCAL'] === 'true') {
    const seedEnv = { ...process.env, E2E_HUB_USER_EMAIL: TEST_USER.email };
    execSync('npm run build:seed', { cwd: __dirname, stdio: 'inherit', env: seedEnv });
    execSync('node ./dist/setup-e2e-db.mjs', { cwd: __dirname, stdio: 'inherit', env: seedEnv });
  }
});
