import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';

test.describe('Calories Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['meals', 'measurements', 'calories_profile']);
    await page.request.put('/api/users/profile', { data: { country: null, timezone: null } });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  /**
   * Full calories workflow: verify layout, edit profile, add/edit/delete a meal,
   * and add/delete a body measurement — all in a single session on clean state.
   */
  test('full calories workflow: profile edit, meal CRUD, measurement CRUD', async ({ page }) => {
    // ── 1. Layout ─────────────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Calories', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();

    // ── 2. Edit profile (age + sex) ───────────────────────────────────────────
    await page.getByRole('button', { name: /^edit$/i }).click();
    await page.getByRole('spinbutton', { name: /^age$/i }).fill('30');
    await page.getByRole('combobox', { name: /^sex$/i }).selectOption('male');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // ── 3. Add meal ───────────────────────────────────────────────────────────
    const originalMeal = `Meal ${Date.now()} original`;
    const updatedMeal = `Meal ${Date.now()} updated`;

    await page.getByRole('button', { name: /add meal/i }).click();
    await page.getByRole('textbox', { name: /description/i }).fill(originalMeal);
    await page.getByRole('spinbutton', { name: /calories/i }).fill('400');
    await page.getByRole('button', { name: /^add$/i }).click();
    await page.getByRole('button', { name: /Show meals/i }).click();
    await expect(page.getByText(originalMeal)).toBeVisible({ timeout: 5_000 });

    // ── 4. Edit meal ──────────────────────────────────────────────────────────
    const mealsSection = page.getByRole('heading', { name: 'Meals' }).locator('xpath=ancestor::section[1]');
    const mealRow = mealsSection
      .locator('[class*="flex items-center justify-between"]')
      .filter({ hasText: originalMeal })
      .first();
    await mealRow.click();
    await mealsSection.getByRole('textbox', { name: /description/i }).fill(updatedMeal);
    await mealsSection.getByRole('spinbutton', { name: /calories \(kcal\)/i }).fill('520');
    await mealsSection
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();
    await expect(page.getByText(updatedMeal)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(originalMeal)).not.toBeVisible({ timeout: 5_000 });
    const updatedMealRow = mealsSection
      .locator('[class*="flex items-center justify-between"]')
      .filter({ hasText: updatedMeal })
      .first();
    await expect(updatedMealRow).toContainText('520 kcal');

    // ── 5. Delete meal ────────────────────────────────────────────────────────
    await updatedMealRow.hover();
    await updatedMealRow.getByRole('button').click();
    await expect(page.getByText(updatedMeal)).not.toBeVisible({ timeout: 5_000 });

    // ── 6. Add body measurement ───────────────────────────────────────────────
    await page.getByRole('button', { name: /log measurement/i }).click();
    await page.getByRole('combobox', { name: /type/i }).selectOption('weight');
    await page.getByRole('spinbutton', { name: /value/i }).fill('75.5');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/75\.5/).first()).toBeVisible({ timeout: 5_000 });

    // ── 7. Delete measurement ─────────────────────────────────────────────────
    const measurementsSection = page
      .getByRole('heading', { name: 'Body Measurements' })
      .locator('xpath=ancestor::section[1]');
    const measurementCard = measurementsSection
      .locator('div.rounded-lg.border.border-zinc-700.bg-zinc-800.px-4.py-3.relative.group')
      .filter({ hasText: '75.5' })
      .first();
    await expect(measurementCard).toBeVisible({ timeout: 5_000 });
    await measurementCard.hover();
    await measurementCard.locator('button:has-text("✕")').click();
    await expect(measurementsSection.getByText(/75\.5/).first()).not.toBeVisible({ timeout: 5_000 });
  });

  /**
   * Kept separate: requires a page reload mid-test to verify server-side persistence
   * of all profile goal and location fields, which would disrupt a shared flow.
   */
  test('save and reload profile goals and location fields', async ({ page }) => {
    const profileSection = page.getByRole('heading', { name: 'Profile' }).locator('xpath=ancestor::section[1]');

    await profileSection.getByRole('button', { name: /^edit$/i }).click();
    await profileSection.getByRole('spinbutton', { name: /^age$/i }).fill('31');
    await profileSection.getByRole('combobox', { name: /^sex$/i }).selectOption('female');
    await profileSection.getByRole('spinbutton', { name: /height/i }).fill('168');
    await profileSection.getByRole('combobox', { name: /activity level/i }).selectOption('moderately_active');
    await profileSection.getByRole('combobox', { name: /goal type/i }).selectOption('weight_loss');
    await profileSection.getByRole('spinbutton', { name: /rate/i }).fill('0.5');
    await profileSection.getByRole('spinbutton', { name: /min calories\/day/i }).fill('1400');
    await profileSection.getByRole('spinbutton', { name: /max calories\/day/i }).fill('1900');
    await profileSection
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();
    await expect(profileSection.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // Reload to assert persisted server state, not local in-memory form state.
    await page.reload();
    await page.waitForLoadState('networkidle');

    const reloadedProfileSection = page.getByRole('heading', { name: 'Profile' }).locator('xpath=ancestor::section[1]');
    await reloadedProfileSection.getByRole('button', { name: /^edit$/i }).click();
    await expect(reloadedProfileSection.getByRole('spinbutton', { name: /^age$/i })).toHaveValue('31');
    await expect(reloadedProfileSection.getByRole('combobox', { name: /^sex$/i })).toHaveValue('female');
    await expect(reloadedProfileSection.getByRole('spinbutton', { name: /height/i })).toHaveValue('168');
    await expect(reloadedProfileSection.getByRole('combobox', { name: /activity level/i })).toHaveValue(
      'moderately_active',
    );
    await expect(reloadedProfileSection.getByRole('combobox', { name: /goal type/i })).toHaveValue('weight_loss');
    await expect(reloadedProfileSection.getByRole('spinbutton', { name: /rate/i })).toHaveValue('0.5');
    await expect(reloadedProfileSection.getByRole('spinbutton', { name: /min calories\/day/i })).toHaveValue('1400');
    await expect(reloadedProfileSection.getByRole('spinbutton', { name: /max calories\/day/i })).toHaveValue('1900');
  });
});
