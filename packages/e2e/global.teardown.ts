import fs from 'node:fs';
import path from 'path';
import { test as teardown } from '@playwright/test';
import { BASE_URL } from './config';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

teardown.use({ storageState: AUTH_FILE });

teardown('cleanup user data via Profile danger zone', async ({ page }) => {
  if (!fs.existsSync(AUTH_FILE)) {
    teardown.skip(true, 'Auth file not found, skipping teardown cleanup.');
  }

  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded' });

  const openDeleteAll = page.getByRole('button', { name: /delete all my data/i });
  await openDeleteAll.waitFor({ state: 'visible', timeout: 15_000 });
  await openDeleteAll.click();

  const confirmDeleteAll = page.getByRole('button', { name: /yes, delete everything/i });
  await confirmDeleteAll.waitFor({ state: 'visible', timeout: 10_000 });

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/user/delete-all') && response.request().method() === 'POST' && response.ok(),
      { timeout: 20_000 },
    ),
    confirmDeleteAll.click(),
  ]);
});
