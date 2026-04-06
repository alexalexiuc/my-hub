import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';

test.describe('Calories Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first to establish session context, then clean data
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['meals', 'measurements', 'calories_profile']);
    await page.request.put('/api/users/profile', { data: { country: null, timezone: null } });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('page shows Calories heading and Profile section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Calories', level: 1 })).toBeVisible();
    // ProfileCard section renders as an h2 titled "Profile"
    await expect(page.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();
  });

  test('open edit profile form and save', async ({ page }) => {
    await page.getByRole('button', { name: /^edit$/i }).click();

    // Field component wraps <label> around the input — spinbutton via type=number
    await page.getByRole('spinbutton', { name: /^age$/i }).fill('30');
    await page.getByRole('combobox', { name: /^sex$/i }).selectOption('male');

    await page.getByRole('button', { name: /^save$/i }).click();

    // After save, edit mode closes and view mode is shown
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('add and delete a meal', async ({ page }) => {
    // Add meal icon button has title="Add meal"
    await page.getByRole('button', { name: /add meal/i }).click();

    // Field "Description *" wraps input via label element
    await page.getByRole('textbox', { name: /description/i }).fill('Test breakfast');
    await page.getByRole('spinbutton', { name: /calories/i }).fill('400');

    await page.getByRole('button', { name: /^add$/i }).click();

    await page.getByRole('button', { name: /Show meals/i }).click();

    await expect(page.getByText('Test breakfast')).toBeVisible({ timeout: 5_000 });

    // Delete: hover to reveal the ✕ button, then click it
    const mealRow = page.locator('[class*="flex items-center justify-between"]', { hasText: 'Test breakfast' });
    await mealRow.hover();
    await mealRow.getByRole('button').click();

    await expect(page.getByText('Test breakfast')).not.toBeVisible({ timeout: 5_000 });
  });

  test('add a body measurement', async ({ page }) => {
    // Click the "Log measurement" button to show the form
    await page.getByRole('button', { name: /log measurement/i }).click();

    // Now the form is visible — select type and fill value
    await page.getByRole('combobox', { name: /type/i }).selectOption('weight');
    await page.getByRole('spinbutton', { name: /value/i }).fill('75.5');
    await page.getByRole('button', { name: /^save$/i }).click();

    // Value and unit are in separate DOM nodes; match the numeric value only
    await expect(page.getByText(/75\.5/).first()).toBeVisible({ timeout: 5_000 });
  });

  test('edit an existing meal', async ({ page }) => {
    const originalMeal = `Meal ${Date.now()} original`;
    const updatedMeal = `Meal ${Date.now()} updated`;

    await page.getByRole('button', { name: /add meal/i }).click();
    await page.getByRole('textbox', { name: /description/i }).fill(originalMeal);
    await page.getByRole('spinbutton', { name: /calories/i }).fill('400');
    await page.getByRole('button', { name: /^add$/i }).click();

    await page.getByRole('button', { name: /Show meals/i }).click();

    await expect(page.getByText(originalMeal)).toBeVisible({ timeout: 5_000 });

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
  });

  test('delete a body measurement', async ({ page }) => {
    await page.getByRole('button', { name: /log measurement/i }).click();
    await page.getByRole('combobox', { name: /type/i }).selectOption('weight');
    await page.getByRole('spinbutton', { name: /value/i }).fill('66.6');
    await page.getByRole('button', { name: /^save$/i }).click();

    const measurementsSection = page
      .getByRole('heading', { name: 'Body Measurements' })
      .locator('xpath=ancestor::section[1]');
    const measurementCard = measurementsSection
      .locator('div.rounded-lg.border.border-zinc-700.bg-zinc-800.px-4.py-3.relative.group')
      .filter({ hasText: '66.6' })
      .first();
    await expect(measurementCard).toBeVisible({ timeout: 5_000 });

    await measurementCard.hover();
    await measurementCard.locator('button:has-text("✕")').click();

    await expect(measurementsSection.getByText(/66\.6/).first()).not.toBeVisible({ timeout: 5_000 });
  });

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
    await profileSection.getByRole('combobox', { name: /country/i }).selectOption('RO');
    await profileSection.getByRole('combobox', { name: /timezone/i }).selectOption('+2');
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
    await expect(reloadedProfileSection.getByRole('combobox', { name: /country/i })).toHaveValue('RO');
    await expect(reloadedProfileSection.getByRole('combobox', { name: /timezone/i })).toHaveValue('+2');
  });
});
