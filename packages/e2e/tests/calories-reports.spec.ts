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

  // expand the meal details to ensure it's fully saved and rendered (the report relies on fetching the meal details, not just the list)
  await page.getByRole('button', { name: /Show meals/i }).click();

  await expect(page.getByText('Report E2E Meal')).toBeVisible({ timeout: 5_000 });
}

test.describe('Calories Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['meals']);
  });

  test('weekly report shows no-data message for empty period', async ({ page }) => {
    await page.goto('/calories/reports/weekly?weekStart=1990-01-01');

    await expect(page.getByRole('heading', { name: 'Weekly Report', level: 1 })).toBeVisible();
    await expect(page.getByText('No meals logged for this week.')).toBeVisible({ timeout: 5_000 });
  });

  test('monthly report shows no-data message for empty period', async ({ page }) => {
    await page.goto('/calories/reports/monthly?monthStart=1990-01-01');

    await expect(page.getByRole('heading', { name: 'Monthly Report', level: 1 })).toBeVisible();
    await expect(page.getByText('No meals logged for this month.')).toBeVisible({ timeout: 5_000 });
  });

  test('weekly report renders preview iframe when data exists and navigates to monthly report', async ({ page }) => {
    await addMealForToday(page);

    await page.goto(`/calories/reports/weekly?weekStart=${currentWeekMondayStr()}`);

    await expect(page.getByRole('heading', { name: 'Weekly Report', level: 1 })).toBeVisible();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Monthly Reports').click();
    await expect(page).toHaveURL(/\/calories\/reports\/monthly/);
  });

  test('monthly report renders preview iframe when data exists and navigates between months', async ({ page }) => {
    await addMealForToday(page);

    await page.goto(`/calories/reports/monthly?monthStart=${currentMonthStartStr()}`);

    await expect(page.getByRole('heading', { name: 'Monthly Report', level: 1 })).toBeVisible();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10_000 });

    const nav = page.locator('div.flex.items-center.justify-center.gap-4').first();
    const label = nav.locator('span').first();
    const initialLabel = (await label.textContent()) ?? '';
    await nav.getByRole('button', { name: /^Next/ }).click();
    await expect(label).not.toHaveText(initialLabel);
  });
});
