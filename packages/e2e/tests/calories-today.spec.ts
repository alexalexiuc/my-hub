import { test, expect, type Page } from '@playwright/test';
import { deleteFeatures } from './helpers';

function uniqueMeal(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Opens the Add Meal modal from the desktop sidebar button. */
async function openAddMealModal(page: Page) {
  await page
    .locator('[data-layout="desktop"]')
    .getByRole('button', { name: /add meal/i })
    .click();
  // Modal is open when the description input is visible
  await expect(page.getByLabel(/description/i)).toBeVisible();
}

/** Fills and submits the meal modal form. */
async function submitMealModal(page: Page, opts: { description: string; calories: number; mealType?: string }) {
  await page.getByLabel(/description/i).fill(opts.description);
  await page.getByLabel(/calories \(kcal\)/i).fill(String(opts.calories));
  if (opts.mealType) {
    await page.getByRole('button', { name: new RegExp(`^${opts.mealType}$`, 'i') }).click();
  }
  await page.getByRole('button', { name: /^add$/i }).click();
  // After adding, wait for the modal to close (description input to disappear) before proceeding with assertions
  await expect(page.getByLabel(/description/i)).not.toBeVisible({ timeout: 5_000 });
}

test.describe('Calories — Today page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['meals']);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('layout: sidebar nav buttons and breadcrumb are visible on desktop', async ({ page }) => {
    const desktop = page.locator('[data-layout="desktop"]');

    await expect(desktop.getByRole('button', { name: /today/i })).toBeVisible();
    await expect(desktop.getByRole('button', { name: /progress/i })).toBeVisible();
    await expect(desktop.getByRole('button', { name: /reports/i })).toBeVisible();
    await expect(desktop.getByRole('button', { name: /settings/i })).toBeVisible();
    await expect(desktop.getByRole('button', { name: /add meal/i })).toBeVisible();

    // Breadcrumb links
    await expect(page.getByRole('link', { name: /calories/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /hub/i })).toBeVisible();
  });

  test('shows empty-state message when no meals are logged', async ({ page }) => {
    await expect(page.getByText(/no meals logged/i)).toBeVisible();
  });

  /**
   * Full meal lifecycle: add → verify → edit → verify update → delete → verify gone.
   * Edit and delete buttons are hover-revealed on desktop rows.
   * Meals render in both mobile and desktop DOM — scope assertions to [data-layout="desktop"].
   */
  test('full meal lifecycle: add via sidebar modal, edit, delete', async ({ page }) => {
    const original = uniqueMeal('Grilled chicken');
    const updated = uniqueMeal('Salmon with quinoa');

    // ── 1. Add meal via sidebar ────────────────────────────────────────────────
    await openAddMealModal(page);
    await submitMealModal(page, { description: original, calories: 450, mealType: 'Lunch' });
    await expect(page.locator('[data-layout="desktop"]').getByText(original)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-layout="desktop"]').getByText('450 kcal')).toBeVisible();

    // ── 2. Meal is grouped under Lunch ────────────────────────────────────────
    await expect(page.getByText(/^lunch$/i)).toBeVisible();

    // ── 3. Edit meal ──────────────────────────────────────────────────────────
    const desktopRow = page.locator('[data-layout="desktop"]').filter({ hasText: original }).first();
    await desktopRow.hover();
    await desktopRow.getByRole('button', { name: /edit meal/i }).click();
    // Modal open: description pre-filled with original value
    await expect(page.getByLabel(/description/i)).toHaveValue(original, { timeout: 5_000 });

    await page.getByLabel(/description/i).fill(updated);
    await page.getByLabel(/calories \(kcal\)/i).fill('520');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.locator('[data-layout="desktop"]').getByText(updated)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-layout="desktop"]').getByText(original)).not.toBeVisible();
    await expect(page.locator('[data-layout="desktop"]').getByText('520 kcal')).toBeVisible();

    // ── 4. Delete meal ────────────────────────────────────────────────────────
    const updatedRow = page.locator('[data-layout="desktop"]').filter({ hasText: updated }).first();
    await updatedRow.hover();
    await updatedRow.getByRole('button', { name: /delete meal/i }).click();

    await expect(
      page
        .locator('[data-layout="desktop"]')
        .getByText(/delete meal/i)
        .first(),
    ).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.locator('[data-layout="desktop"]').getByText(updated)).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/no meals logged/i)).toBeVisible();
  });

  test('adds meal with macros and shows them in the desktop row', async ({ page }) => {
    const name = uniqueMeal('Protein shake');

    await openAddMealModal(page);
    await page.getByLabel(/description/i).fill(name);
    await page.getByLabel(/calories \(kcal\)/i).fill('300');
    await page.getByLabel(/protein \(g\)/i).fill('40');
    await page.getByLabel(/carbs \(g\)/i).fill('20');
    await page.getByLabel(/fat \(g\)/i).fill('5');
    await page.getByRole('button', { name: /^add$/i }).click();

    const desktopRow = page.locator('[data-layout="desktop"]').filter({ hasText: name }).first();
    await expect(desktopRow).toBeVisible({ timeout: 8_000 });
    await expect(desktopRow.getByText(/P 40g/)).toBeVisible();
    await expect(desktopRow.getByText(/C 20g/)).toBeVisible();
    await expect(desktopRow.getByText(/F 5g/)).toBeVisible();
  });

  test('multiple meals show a totals row with summed calories', async ({ page }) => {
    const meal1 = uniqueMeal('Breakfast oats');
    const meal2 = uniqueMeal('Afternoon snack');

    await openAddMealModal(page);
    await submitMealModal(page, { description: meal1, calories: 350, mealType: 'Breakfast' });
    await expect(page.locator('[data-layout="desktop"]').getByText(meal1)).toBeVisible({ timeout: 8_000 });

    await openAddMealModal(page);
    await submitMealModal(page, { description: meal2, calories: 200, mealType: 'Snack' });
    await expect(page.locator('[data-layout="desktop"]').getByText(meal2)).toBeVisible({ timeout: 8_000 });

    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('550 kcal')).toBeVisible();
  });
});
