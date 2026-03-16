import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { TEST_USER } from './config';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

setup('create test user and authenticate', async ({ request, page }) => {
  const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';

  // Register (idempotent — 409 = already exists, that's fine)
  const registerRes = await request.post(`${baseURL}/api/auth/register`, {
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
  }

  // Sign in via the credentials form
  await page.goto(`${baseURL}/auth/signin`);
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Should land on the dashboard
  await expect(page).toHaveURL(`${baseURL}/`, { timeout: 15_000 });

  // Persist auth state (cookies / localStorage) for reuse across tests
  await page.context().storageState({ path: AUTH_FILE });
});
