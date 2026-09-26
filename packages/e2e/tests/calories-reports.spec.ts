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

/**
 * A gaining profile that trains on Mondays, plus a Monday and a Tuesday of meals.
 *
 * The shape matters: the gym day makes the week carry two different calorie ceilings, and the
 * gain goal makes the report's direction visible. A week of identical rest days against a loss
 * goal would render the same whether the two bugs below were fixed or not.
 */
async function seedGymWeekProfile(page: Page) {
  const monday = currentWeekMondayStr();
  const tues = new Date(`${monday}T12:00:00`);
  tues.setDate(tues.getDate() + 1);

  await page.request.put('/api/calories/profile', {
    data: {
      age: 34,
      sex: 'male',
      heightCm: 178,
      activityLevel: 'moderately_active',
      goalType: 'weight_gain',
      goalWeeklyRateKg: 0.25,
      goalMinCalories: 2700,
      goalMaxCalories: 3200,
      gymDays: [0], // Monday
      gymDayCalorieBonus: 1000, // Monday's ceiling becomes 4,200
      gymTime: 'morning',
    },
  });
  await page.request.post('/api/calories/measurements', {
    data: { typeKey: 'weight', value: 78.7, date: monday },
  });
  await page.request.post('/api/calories/meals', {
    data: { description: 'Gym day meal', mealType: 'lunch', kcal: 4100, date: monday },
  });
  await page.request.post('/api/calories/meals', {
    data: { description: 'Rest day meal', mealType: 'lunch', kcal: 3050, date: dateStr(tues) },
  });
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

  /**
   * The report's numbers, not just its existence.
   *
   * Every other assertion in this file checks that an iframe is visible, which it is regardless of
   * what the report says. Two bugs lived comfortably behind that: the report judged every day
   * against one flat ceiling, so a gym day eaten to plan was reported as hundreds over and named
   * the week's worst day; and it treated the weekly rate as a loss whatever the goal, printing a
   * gaining user's target as a negative number and projecting them lighter each week.
   *
   * Both are invisible unless something reads inside the frame.
   */
  test('weekly report judges gym days against their own ceiling and reports the goal direction', async ({ page }) => {
    await deleteFeatures(page, ['calories_profile', 'measurements']);
    await seedGymWeekProfile(page);

    await page.goto(`/calories/reports/weekly?weekStart=${currentWeekMondayStr()}`);
    const report = page.frameLocator('iframe');

    // ── 1. Both ceilings are named — 3,200 on rest days, 4,200 on the gym day ─
    await expect(report.getByText(/Goal:\s*3,200\s*\/\s*4,200 kcal\/day/)).toBeVisible({ timeout: 15_000 });

    // ── 2. Monday ate 4,100 against a 4,200 ceiling: under, not 900 over ──────
    const mondayRow = report.locator('tr').filter({ hasText: '4,100' });
    await expect(mondayRow).toContainText('−100');
    await expect(mondayRow).not.toContainText('+900');

    // ── 3. The goal reads as a gain, at the rate actually set ────────────────
    // Also guards the rounding: `toFixed(1)` printed a 0.25 kg/week goal back as "0.3".
    await expect(report.getByText('Weekly target: +0.25 kg')).toBeVisible();
    await expect(report.getByText(/Goal rate \+0\.25 kg\/week/)).toBeVisible();

    // ── 4. A surplus is called a surplus ─────────────────────────────────────
    await expect(report.getByText('Daily surplus')).toBeVisible();
    await expect(report.getByText('Daily deficit')).toBeHidden();
  });
});
