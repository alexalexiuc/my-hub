import { test, expect, type Page } from '@playwright/test';

const LEAVE_TAG = '[e2e-vacation]';
const SALARY_MONTH = '2030-01';

/** Removes leave and the salary month this spec creates, left behind by an interrupted run. */
async function cleanup(page: Page) {
  const res = await page.request.get('/api/vacation/config');
  if (!res.ok()) return;
  const config = (await res.json()) as { leavePeriods: { id: number; notes: string | null }[] };
  for (const l of config.leavePeriods.filter(p => p.notes?.startsWith(LEAVE_TAG))) {
    await page.request.delete(`/api/vacation/leave/${l.id}`);
  }
  await page.request.delete(`/api/vacation/salaries/${SALARY_MONTH}`);
}

/** The desktop sidebar: below `md` the bottom nav renders the same links a second time. */
const sidebar = (page: Page) => page.locator('[data-layout="desktop"]');

test.describe('Vacation planner tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vacation');
    await cleanup(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  /**
   * One journey through the menu: the calendar stays the landing tab, then the profile is saved,
   * a vacation is recorded and removed, and a payment is recorded and removed.
   */
  test('navigates the tabs and manages profile, vacations and payments', async ({ page }) => {
    // ── 1. Calendar is the landing tab ──────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
    await expect(page.locator('[data-feature="vacation"]')).toBeVisible();

    // ── 2. Profile: create or update ────────────────────────────────────────────
    await sidebar(page).getByRole('button', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/vacation\/profile$/);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await page.getByRole('textbox', { name: /^Employer/ }).fill('E2E Employer');
    await page.getByRole('textbox', { name: /^Country/ }).fill('MD');
    await page.getByRole('spinbutton', { name: /^Opening balance \(days\)/ }).fill('10');
    await page.getByLabel(/^Opening balance date/).fill('2026-01-01');
    const saveProfile = page.getByRole('button', { name: /^(Save|Create) profile$/ });
    const profileSaved = page.waitForResponse(
      r => r.url().includes('/api/vacation/profile') && r.request().method() === 'PUT',
    );
    await saveProfile.click();
    expect((await profileSaved).ok()).toBe(true);
    await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();

    // ── 3. Vacations: add, then delete ──────────────────────────────────────────
    await sidebar(page).getByRole('button', { name: 'Vacations' }).click();
    await expect(page).toHaveURL(/\/vacation\/leave$/);
    await page.getByRole('button', { name: 'Add vacation' }).click();
    const leaveForm = page.getByRole('form', { name: 'Add vacation' });
    await leaveForm.getByLabel('First day').fill('2030-07-01');
    await leaveForm.getByLabel('Last day').fill('2030-07-03');
    await leaveForm.getByLabel('Notes').fill(`${LEAVE_TAG} summer`);
    await leaveForm.getByRole('button', { name: 'Add vacation' }).click();

    const leaveRow = page.getByRole('listitem').filter({ hasText: `${LEAVE_TAG} summer` });
    await expect(leaveRow).toBeVisible();
    await expect(leaveRow.getByText('3 days')).toBeVisible();
    // Tapping the row expands the vacation's totals: the pay estimate, or — with no salary recorded
    // for the months the pay is averaged over — the notice saying it can't be estimated.
    await leaveRow.getByRole('button', { name: /2030-07-01/ }).click();
    await expect(
      leaveRow.getByText('Balance cost').or(leaveRow.getByText(/^No salary is recorded for the months/)),
    ).toBeVisible();
    await leaveRow.getByRole('button', { name: 'Delete vacation' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(leaveRow).toHaveCount(0);

    // ── 4. Payments: add, then delete ───────────────────────────────────────────
    await sidebar(page).getByRole('button', { name: 'Payments' }).click();
    await expect(page).toHaveURL(/\/vacation\/payments$/);
    await page.getByRole('button', { name: 'Add payment' }).click();
    const salaryForm = page.getByRole('form', { name: 'Add payment' });
    await salaryForm.locator('input[type="month"]').fill(SALARY_MONTH);
    await salaryForm.getByRole('spinbutton', { name: /^Base salary/ }).fill('30000');
    await salaryForm.getByRole('button', { name: 'Add payment' }).click();

    const salaryRow = page.locator(`[data-month="${SALARY_MONTH}"]`);
    await expect(salaryRow).toContainText('30,000 MDL');
    await salaryRow.getByRole('button', { name: 'Delete payment' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(salaryRow).toHaveCount(0);

    // ── 5. Back to the calendar ─────────────────────────────────────────────────
    await sidebar(page).getByRole('button', { name: 'Calendar' }).click();
    await expect(page).toHaveURL(/\/vacation$/);
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });
});
