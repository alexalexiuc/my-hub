import { test, expect, type Page } from '@playwright/test';
import { deleteFeatures } from './helpers';

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
   * Full measurement lifecycle: add weight → verify card → delete → verify gone.
   * The delete button is opacity-0 by default (revealed on hover); use force click.
   */
  test('full measurement lifecycle: add weight, verify card, delete', async ({ page }) => {
    // ── 1. Open modal and select weight ───────────────────────────────────────
    await openMeasurementModal(page, 'Weight');

    // ── 2. Fill value and save ────────────────────────────────────────────────
    await page.getByLabel(/value/i).fill('75.5');
    await page.getByRole('button', { name: /^save$/i }).click();

    // ── 3. Weight card appears in the measurements grid ───────────────────────
    await expect(page.getByText('75.5')).toBeVisible({ timeout: 8_000 });

    // ── 4. Delete: button is opacity-0 until hover — use force click ──────────
    await page.getByRole('button', { name: /delete measurement/i }).click({ force: true });
    await page.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByText('75.5')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/no measurements recorded yet/i)).toBeVisible();
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
