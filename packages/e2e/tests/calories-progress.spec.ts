import { test, expect, type Page } from '@playwright/test';
import { deleteFeatures, periodLabel } from './helpers';

/**
 * The body-measurements card. "Today" and other short labels also appear in the sidebar and the
 * chart axis, so assertions about a measurement have to be scoped to its own section.
 */
function measurementsCard(page: Page) {
  return page
    .getByRole('heading', { name: /body measurements/i })
    .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

/** Opens the measurement modal and selects a type. Type options render as "Label (unit)" buttons. */
async function openMeasurementModal(page: Page, typeLabel: string) {
  await page.getByRole('button', { name: /^add$/i }).click();
  await expect(page.getByPlaceholder(/search types/i)).toBeVisible();
  await page.getByPlaceholder(/search types/i).fill(typeLabel);
  // SearchableSelect renders filtered options as buttons — click the first match
  await page
    .getByRole('button', { name: new RegExp(typeLabel, 'i') })
    .first()
    .click();
}

test.describe('Calories — Progress page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calories/progress');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['measurements']);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('layout: weekly chart and body measurements section are present', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /this week/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /body measurements/i })).toBeVisible();
    await expect(page.getByText(/no measurements recorded yet/i)).toBeVisible();
  });

  /**
   * Full measurement lifecycle: add weight → verify card → edit → delete → verify gone.
   * On desktop the row controls are hover-revealed; use force click rather than hovering.
   */
  test('full measurement lifecycle: add weight, verify card, edit, delete', async ({ page }) => {
    // ── 1. Open modal and select weight ───────────────────────────────────────
    await openMeasurementModal(page, 'Weight');

    // ── 2. Fill value and save ────────────────────────────────────────────────
    await page.getByLabel(/value/i).fill('75.5');
    await page.getByRole('button', { name: /^save$/i }).click();

    // ── 3. Weight card appears in the measurements grid ───────────────────────
    await expect(page.getByText('75.5')).toBeVisible({ timeout: 8_000 });
    // Recorded today, shown as a word rather than a raw ISO date.
    await expect(measurementsCard(page).getByText('Today', { exact: true })).toBeVisible();

    // ── 4. Edit corrects the value in place, without a second entry ───────────
    await page.getByRole('button', { name: /edit measurement/i }).click({ force: true });
    await expect(page.getByLabel(/value/i)).toHaveValue('75.5', { timeout: 5_000 });
    await page.getByLabel(/value/i).fill('74.2');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText('74.2')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('75.5')).toBeHidden();

    // ── 5. Delete ─────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /delete measurement/i }).click({ force: true });
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByText('74.2')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/no measurements recorded yet/i)).toBeVisible();
  });

  /**
   * Week navigation is bounded: the current week is the newest one there can be data for, so
   * stepping forward from it is barred rather than showing an empty future week.
   */
  test('week navigation steps back and stops at the current week', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: 'Next period' });
    const prevButton = page.getByRole('button', { name: 'Previous period' });

    await expect(periodLabel(page)).toHaveText('This week');
    await expect(nextButton).toBeDisabled();

    await prevButton.click();
    await expect(nextButton).toBeEnabled();
    // One step back is one week, not two — the label is derived from a UTC-parsed date, and
    // parsing it locally used to skip a week in any positive-offset timezone.
    await expect(periodLabel(page)).toHaveText(/^Week \d+, \d{4}$/);

    await nextButton.click();
    await expect(periodLabel(page)).toHaveText('This week');
    await expect(nextButton).toBeDisabled();
  });

  test('adds two measurement types and both cards appear in the grid', async ({ page }) => {
    // Add weight
    await openMeasurementModal(page, 'Weight');
    await page.getByLabel(/value/i).fill('80');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('80')).toBeVisible({ timeout: 8_000 });

    // Add waist
    await openMeasurementModal(page, 'Waist');
    await page.getByLabel(/value/i).fill('88');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('88')).toBeVisible({ timeout: 8_000 });

    await expect(page.getByText('80')).toBeVisible();
    await expect(page.getByText('88')).toBeVisible();
  });
});
