import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';
import { TEST_USER } from '../config';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.request.put('/api/users/profile', { data: { name: null, country: null, timezone: null } });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  /**
   * Profile page layout and non-destructive actions: account info, personal info edit
   * (name + country + timezone), reload to verify persistence, and sign-out button.
   */
  test('displays account info, allows personal info edit, and shows sign-out', async ({ page }) => {
    // ── 1. Account info ───────────────────────────────────────────────────────
    await expect(page.locator('.font-medium', { hasText: TEST_USER.email })).toBeVisible();
    await expect(page.getByText(/member since/i)).toBeVisible();

    // ── 2. Edit name, country, and timezone ───────────────────────────────────
    const personalInfoSection = page
      .getByRole('heading', { name: /personal information/i })
      .locator('xpath=ancestor::section[1]');
    await personalInfoSection.getByRole('button', { name: /^edit$/i }).click();
    await personalInfoSection.getByPlaceholder(/enter your name/i).fill('E2E Tester');
    await personalInfoSection.getByRole('combobox', { name: /country/i }).selectOption('RO');
    await personalInfoSection.getByRole('combobox', { name: /timezone/i }).selectOption('+2');
    await personalInfoSection.getByRole('button', { name: /^save$/i }).click();
    await expect(personalInfoSection.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // ── 3. Reload to verify persistence ──────────────────────────────────────
    await page.reload();
    await page.waitForLoadState('networkidle');
    const reloaded = page.getByRole('heading', { name: /personal information/i }).locator('xpath=ancestor::section[1]');
    await reloaded.getByRole('button', { name: /^edit$/i }).click();
    await expect(reloaded.getByPlaceholder(/enter your name/i)).toHaveValue('E2E Tester');
    await expect(reloaded.getByRole('combobox', { name: /country/i })).toHaveValue('RO');
    await expect(reloaded.getByRole('combobox', { name: /timezone/i })).toHaveValue('+2');

    // ── 4. Sign-out button present ────────────────────────────────────────────
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
