import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';
import { TEST_USER } from '../config';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
  });

  test('shows account info (email and member since)', async ({ page }) => {
    // Use the span inside the Account section
    await expect(page.locator('.font-medium', { hasText: TEST_USER.email })).toBeVisible();
    await expect(page.getByText(/member since/i)).toBeVisible();
  });

  test('edit and save display name', async ({ page }) => {
    const nameInput = page.getByPlaceholder(/enter your name/i);
    await nameInput.clear();
    await nameInput.fill('E2E Tester');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(/name updated/i)).toBeVisible({ timeout: 5_000 });
  });

  test('delete specific data with two-step confirmation', async ({ page }) => {
    // Seed a meal
    await page.request.post('/api/calories/meals', {
      data: {
        description: 'Test meal for deletion',
        kcal: 300,
        loggedAt: new Date().toISOString(),
        mealType: 'snack',
      },
    });

    // Check meals checkbox
    await page.getByLabel(/meal logs/i).check();

    // "Delete selected data…" button appears
    await page.getByRole('button', { name: /delete selected data/i }).click();

    // Confirmation dialog
    await expect(page.getByText(/are you sure/i)).toBeVisible();
    // The list in the confirmation shows "Meal logs"
    await expect(page.locator('ul li', { hasText: 'Meal logs' })).toBeVisible();

    await page.getByRole('button', { name: /yes, delete permanently/i }).click();

    await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 5_000 });

    // Clean up
    await deleteFeatures(page, ['meals']);
  });

  test('delete all data with danger zone', async ({ page }) => {
    await page.request.post('/api/calories/meals', {
      data: { description: 'Meal to wipe', kcal: 200, loggedAt: new Date().toISOString(), mealType: 'lunch' },
    });

    await page.getByRole('button', { name: /delete all my data/i }).click();
    await expect(page.getByText(/wipe all your data/i)).toBeVisible();
    await page.getByRole('button', { name: /yes, delete everything/i }).click();

    // Returns to initial state
    await expect(page.getByRole('button', { name: /delete all my data/i })).toBeVisible({ timeout: 5_000 });
  });

  test('sign out link is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });
});
