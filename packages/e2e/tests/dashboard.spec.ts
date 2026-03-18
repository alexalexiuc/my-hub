import { test, expect } from '@playwright/test';

test.describe('Main Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for client-side content to load
    await page.waitForLoadState('networkidle');
  });

  test('shows the hub title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /my hub/i })).toBeVisible();
  });

  test('shows Calories app tile', async ({ page }) => {
    await expect(page.getByRole('link', { name: /calories/i }).first()).toBeVisible();
  });

  test('shows Todo app tile', async ({ page }) => {
    await expect(page.getByRole('link', { name: /todo/i })).toBeVisible();
  });

  test('shows MCP Control admin link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /mcp control/i })).toBeVisible();
  });

  test('shows Profile link in header', async ({ page }) => {
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible();
  });

  test('navigates to calories dashboard', async ({ page }) => {
    await page
      .getByRole('link', { name: /calories/i })
      .first()
      .click();
    await expect(page).toHaveURL('/calories');
  });
});
