import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';
import { TEST_USER } from '../config';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Profile page layout and non-destructive actions: account info, display name edit,
   * and sign-out button — all verifiable in a single session without side effects.
   */
  test('displays account info, allows name edit, and shows sign-out', async ({ page }) => {
    // ── 1. Account info ───────────────────────────────────────────────────────
    await expect(page.locator('.font-medium', { hasText: TEST_USER.email })).toBeVisible();
    await expect(page.getByText(/member since/i)).toBeVisible();

    // ── 2. Edit display name ──────────────────────────────────────────────────
    const nameInput = page.getByPlaceholder(/enter your name/i);
    await nameInput.clear();
    await nameInput.fill('E2E Tester');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/name updated/i)).toBeVisible({ timeout: 5_000 });

    // ── 3. Sign-out button present ────────────────────────────────────────────
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  /**
   * Kept separate: seeds a meal via API, performs a destructive two-step delete
   * confirmation, then tears down. The teardown resets shared data, so this must
   * not share state with the main flow test.
   */
  test('delete specific data with two-step confirmation', async ({ page }) => {
    await page.request.post('/api/calories/meals', {
      data: {
        description: 'Test meal for deletion',
        kcal: 300,
        loggedAt: new Date().toISOString(),
        mealType: 'snack',
      },
    });

    await page.getByLabel(/meal logs/i).check();
    await page.getByRole('button', { name: /delete selected data/i }).click();

    await expect(page.getByText(/are you sure/i)).toBeVisible();
    await expect(page.locator('ul li', { hasText: 'Meal logs' })).toBeVisible();

    await page.getByRole('button', { name: /yes, delete permanently/i }).click();
    await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 5_000 });

    await deleteFeatures(page, ['meals']);
  });
});
