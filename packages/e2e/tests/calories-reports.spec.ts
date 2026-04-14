import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';

function dateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function currentWeekMondayStr(): string {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay();
  const daysSinceMonday = (day + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return dateStr(monday);
}

function currentMonthStartStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

async function addMealForToday(page: Parameters<(typeof test)['beforeEach']>[0]['page']) {
  await page.goto('/calories');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /add meal/i }).click();
  await page.getByRole('textbox', { name: /description/i }).fill('Report E2E Meal');
  await page.getByRole('spinbutton', { name: /calories/i }).fill('550');
  await page.getByRole('button', { name: /^add$/i }).click();

  await page.getByRole('button', { name: /Show meals/i }).click();
  await expect(page.getByText('Report E2E Meal')).toBeVisible({ timeout: 5_000 });
}

test.describe('Calories Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['meals']);
  });

  /**
   * Empty state: both weekly and monthly reports show no-data messages
   * when navigated to a period with no meals (1990).
   */
  test('reports show empty-state messages for periods with no data', async ({ page }) => {
    // ── 1. Weekly empty state ─────────────────────────────────────────────────
    await page.goto('/calories/reports/weekly?weekStart=1990-01-01');
    await expect(page.getByRole('heading', { name: 'Weekly Report', level: 1 })).toBeVisible();
    await expect(page.getByText('No meals logged for this week.')).toBeVisible({ timeout: 5_000 });

    // ── 2. Monthly empty state ────────────────────────────────────────────────
    await page.goto('/calories/reports/monthly?monthStart=1990-01-01');
    await expect(page.getByRole('heading', { name: 'Monthly Report', level: 1 })).toBeVisible();
    await expect(page.getByText('No meals logged for this month.')).toBeVisible({ timeout: 5_000 });
  });

  /**
   * With-data rendering: weekly and monthly reports both render a preview iframe,
   * cross-report navigation works, and month navigation updates the label.
   */
  test('reports render data and support navigation between views', async ({ page }) => {
    await addMealForToday(page);

    // ── 1. Weekly report renders iframe ───────────────────────────────────────
    await page.goto(`/calories/reports/weekly?weekStart=${currentWeekMondayStr()}`);
    await expect(page.getByRole('heading', { name: 'Weekly Report', level: 1 })).toBeVisible();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10_000 });

    // ── 2. Navigate to monthly report via link (cross-report navigation) ──────
    await page.getByLabel('Monthly Reports').click();
    await expect(page).toHaveURL(/\/calories\/reports\/monthly/);

    // Navigate explicitly with monthStart so the page has data (the link may
    // omit the param, landing on a default period that may differ from today).
    await page.goto(`/calories/reports/monthly?monthStart=${currentMonthStartStr()}`);
    await expect(page.getByRole('heading', { name: 'Monthly Report', level: 1 })).toBeVisible();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10_000 });

    // ── 3. Month navigation updates label ─────────────────────────────────────
    const nav = page.locator('div.flex.items-center.justify-center.gap-4').first();
    const label = nav.locator('span').first();
    const initialLabel = (await label.textContent()) ?? '';
    await nav.getByRole('button', { name: /^Next/ }).click();
    await expect(label).not.toHaveText(initialLabel);
  });
});
