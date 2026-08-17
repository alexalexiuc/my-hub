import { test, expect, Page } from '@playwright/test';
import { deleteFeatures, periodLabel } from './helpers';

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

async function addMealForToday(page: Page) {
  await page.goto('/calories');
  await page.waitForLoadState('networkidle');

  await page
    .locator('[data-layout="desktop"]')
    .getByRole('button', { name: /add meal/i })
    .click();
  await page.getByLabel(/description/i).fill('Report E2E Meal');
  await page.getByLabel(/calories/i).fill('550');
  await page.getByRole('button', { name: /^add$/i }).click();

  await expect(page.locator('[data-layout="desktop"]').getByText('Report E2E Meal')).toBeVisible({ timeout: 5_000 });
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
    await expect(page.getByText('No meals logged for this month.')).toBeVisible({ timeout: 15_000 });
  });

  /**
   * The tabbed page is the one the sidebar and bottom nav link to — the standalone weekly/monthly
   * pages below are only reachable from the emailed reports' "view in app" link.
   */
  test('tabbed reports page: switches period, records it in the URL, and stops at the current one', async ({
    page,
  }) => {
    await addMealForToday(page);

    await page.goto('/calories/reports');
    await page.waitForLoadState('networkidle');

    const label = periodLabel(page);

    // ── 1. Opens on the week in progress, which is as far forward as it goes ──
    await expect(label).toHaveText('This week');
    await expect(page.getByRole('button', { name: 'Next period' })).toBeDisabled();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10_000 });

    // ── 2. Switching to monthly is reflected in the URL, so the view is linkable ──
    await page.getByRole('button', { name: 'monthly', exact: true }).click();
    await expect(page).toHaveURL(/\?tab=monthly/);
    await expect(label).toHaveText('This month');

    // ── 3. The period resets per tab rather than carrying a week index into months ──
    await page.getByRole('button', { name: 'Previous period' }).click();
    await expect(label).not.toHaveText('This month');

    await page.getByRole('button', { name: 'weekly', exact: true }).click();
    await expect(page).toHaveURL(/\?tab=weekly/);
    await expect(label).toHaveText('This week');
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

    // ── 3. Month navigation: back a month updates the label, forward is barred ─
    // Stepping back rather than forward, because the page is on the current month and every
    // period beyond it can only be empty — "Next" is deliberately disabled there.
    const nextButton = page.getByRole('button', { name: 'Next period' });
    const prevButton = page.getByRole('button', { name: 'Previous period' });
    const label = page.getByText('This month', { exact: true });

    await expect(label).toBeVisible();
    await expect(nextButton).toBeDisabled();

    await prevButton.click();
    await expect(page.getByText('This month', { exact: true })).toBeHidden();
    await expect(nextButton).toBeEnabled();

    // ── 4. And forward again returns to the current month ─────────────────────
    await nextButton.click();
    await expect(page.getByText('This month', { exact: true })).toBeVisible();
    await expect(nextButton).toBeDisabled();
  });
});
