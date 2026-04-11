import { test, expect } from '@playwright/test';

test.describe('Main Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('displays all UI elements and navigates to calories', async ({ page }) => {
    // ── 1. Core tiles and links ───────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: /my hub/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /calories/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /todo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /mcp control/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible();

    // ── 2. Navigation ─────────────────────────────────────────────────────────
    await page
      .getByRole('link', { name: /calories/i })
      .first()
      .click();
    await expect(page).toHaveURL('/calories');
  });
});
