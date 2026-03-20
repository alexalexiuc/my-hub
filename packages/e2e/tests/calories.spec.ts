import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';

test.describe('Calories Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first to establish session context, then clean data
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['meals', 'measurements', 'calories_profile']);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('page shows Calories heading and Profile section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Calories', level: 1 })).toBeVisible();
    // SectionCard renders an h2 titled "Settings" (the ProfileCard section)
    await expect(page.getByRole('heading', { name: 'Settings', level: 2 })).toBeVisible();
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
});
