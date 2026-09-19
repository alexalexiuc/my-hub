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
    await expect(page.getByRole('link', { name: /finances/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /mcp control/i })).toBeVisible();
    // Exact name, not a /profile/i regex: the Calories widget's "Complete your profile" link
    // (shown whenever the account has no calorie profile yet, as this fresh test user doesn't at
    // this point) also matches a loose "profile" pattern and made this a strict-mode violation.
    await expect(page.getByRole('link', { name: 'Profile & Settings', exact: true })).toBeVisible();

    // ── 2. Navigation ─────────────────────────────────────────────────────────
    await page
      .getByRole('link', { name: /calories/i })
      .first()
      .click();
    await expect(page).toHaveURL('/calories');
  });
});
