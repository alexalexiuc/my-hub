import { test, expect, type Page, type Locator } from '@playwright/test';
import { dateToString, startOfWeekMonday, addDays, toUTCDateStr } from '@my-hub/shared/utils';
import { deleteFeatures } from './helpers';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function randomStamp() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function uniqueDesc(prefix: string) {
  return `${prefix} ${randomStamp()}`;
}

/** Today's day-of-week index, 0=Mon … 6=Sun (same convention as the app's DayOfWeek). */
function todayDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sun … 6=Sat
  return (jsDay === 0 ? 7 : jsDay) - 1;
}

/** YYYY-MM-DD Monday of the week containing today (same shared utils the app uses). */
function currentWeekMonday(): string {
  return dateToString(startOfWeekMonday(new Date()));
}

/** Advances a YYYY-MM-DD Monday by n weeks (all-UTC, mirroring the app's shiftWeek). */
function shiftWeek(monday: string, n: number): string {
  return toUTCDateStr(addDays(new Date(monday), n * 7));
}

/** Asserts which week the WeekNavigator has selected, via its stable data attribute. */
async function expectSelectedWeek(page: Page, monday: string) {
  await expect(page.locator('[data-week-start]')).toHaveAttribute('data-week-start', monday);
}

/** Inside the Create-menu modal: activate a day tab and fill its first meal row. */
async function fillModalDay(modal: Locator, day: number, description: string, kcal: string) {
  await modal.getByRole('button', { name: new RegExp(`^${DAY_SHORT[day]}`) }).click();
  await modal.getByPlaceholder('e.g. Oats with banana').first().fill(description);
  await modal.getByPlaceholder('kcal', { exact: true }).first().fill(kcal);
}

/** The MealRow container inside a day card, found by its unique description text. */
function mealRow(dayCard: Locator, description: string): Locator {
  return dayCard.getByText(description).locator('..');
}

test.describe('Calories — Weekly Menu page', () => {
  test.beforeEach(async ({ page }) => {
    // goto only establishes auth cookies for the API call — no need to wait for
    // the page's data fetches to settle, the reload discards them anyway.
    await page.goto('/calories/menu');
    await deleteFeatures(page, ['weekly_menus', 'meals']);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  /**
   * One natural journey through the whole feature:
   * empty state → create a current-week menu (with modal validation checks) →
   * edit / add / remove meals on today's card → log meals (single + full day) →
   * verify logged meals appear on the Today page and survive a reload →
   * navigate between two menus → delete both → empty state again.
   *
   * The create modal only requires meals for days that haven't passed yet
   * (today … Sunday), so the fill loop starts at today's day-of-week index.
   */
  test('full weekly menu journey: create, edit meals, log, navigate weeks, delete', async ({ page }) => {
    const today = todayDayOfWeek();
    const monday = currentWeekMonday();
    const runStamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const descFor = (d: number) => `Menu meal ${DAY_SHORT[d]} ${runStamp}`;

    // ── 1. Empty state ─────────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Weekly Menu' })).toBeVisible();
    await expect(page.getByText('No weekly menus yet')).toBeVisible();

    // ── 2. Open Create modal — defaults to the current week ───────────────────
    await page.getByRole('button', { name: 'Create' }).click();
    const modal = page.locator('.modal-card');
    await expect(modal.getByText('Create weekly menu')).toBeVisible();
    // ‹ is disabled on the current week (past weeks are not allowed)
    await expect(modal.getByRole('button', { name: '‹' })).toBeDisabled();

    // ── 3. Validation: submit disabled while days are missing ─────────────────
    const submitBtn = modal.getByRole('button', { name: 'Create menu' });
    await expect(submitBtn).toBeDisabled();
    await expect(modal.getByText(/Still missing:/)).toBeVisible();

    // ── 4. Validation: duplicate meal type on the same day is flagged ─────────
    await fillModalDay(modal, today, descFor(today), '600');
    await modal.getByRole('button', { name: 'Add meal' }).click();
    // Second row defaults to the same meal type (lunch) → duplicate warning
    await modal.getByPlaceholder('e.g. Oats with banana').last().fill('Duplicate row');
    await expect(modal.getByText(/Duplicate meal types on:/)).toBeVisible();
    await expect(submitBtn).toBeDisabled();
    await modal.getByRole('button', { name: 'Remove meal' }).last().click();
    await expect(modal.getByText(/Duplicate meal types on:/)).not.toBeVisible();

    // ── 5. Fill the remaining available days and create ────────────────────────
    for (let d = today + 1; d <= 6; d++) {
      await fillModalDay(modal, d, descFor(d), '600');
    }
    await expect(modal.getByText('All days have at least one meal ✓')).toBeVisible();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect(modal.getByText('Create weekly menu')).not.toBeVisible({ timeout: 8_000 });

    // ── 6. Menu detail renders: navigator, target card, today's meal ──────────
    await expect(page.getByText('1 / 1')).toBeVisible();
    await expectSelectedWeek(page, monday);
    await expect(page.getByText('Week plan vs. target')).toBeVisible();
    const todayCard = page.locator(`[data-day="${today}"]`);
    await expect(todayCard.getByText(descFor(today))).toBeVisible();
    await expect(todayCard.getByText('600 kcal').first()).toBeVisible();

    // ── 7. Edit (swap) today's meal ────────────────────────────────────────────
    const swappedDesc = uniqueDesc('Swapped meal');
    await todayCard.getByRole('button', { name: 'Edit this meal' }).click();
    await expect(modal.getByText('Edit meal')).toBeVisible();
    await modal.getByPlaceholder('e.g. Grilled sea bass with roasted vegetables').fill(swappedDesc);
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(todayCard.getByText(swappedDesc)).toBeVisible({ timeout: 8_000 });
    await expect(todayCard.getByText(descFor(today))).not.toBeVisible();

    // ── 8. Add a second meal to today's card via the inline form ──────────────
    const addedDesc = uniqueDesc('Added breakfast');
    await todayCard.getByRole('button', { name: /add meal/i }).click();
    await todayCard.getByPlaceholder('What will you eat?').fill(addedDesc);
    await todayCard.getByPlaceholder('kcal', { exact: true }).fill('250');
    await todayCard.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(todayCard.getByText(addedDesc)).toBeVisible({ timeout: 8_000 });

    // ── 9. Add a third meal, then remove it via the confirm dialog ────────────
    const removedDesc = uniqueDesc('Removable meal');
    await todayCard.getByRole('button', { name: /add meal/i }).click();
    await todayCard.getByPlaceholder('What will you eat?').fill(removedDesc);
    await todayCard.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(todayCard.getByText(removedDesc)).toBeVisible({ timeout: 8_000 });

    await mealRow(todayCard, removedDesc).getByRole('button', { name: 'Remove this meal' }).click();
    await expect(modal.getByText('Remove meal', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    // exact: true — the confirm dialog (rendered inside the card) quotes the description in its message
    await expect(todayCard.getByText(removedDesc, { exact: true })).not.toBeVisible({ timeout: 8_000 });

    // ── 10. Shopping list modal: add, check off, persist, remove ──────────────
    const shoppingItem = uniqueDesc('Olive oil');
    await page.getByRole('button', { name: 'Shopping list' }).click();
    await expect(modal.getByText('Shopping List')).toBeVisible();
    // The list starts empty — the assistant writes it via MCP, the user can add here
    await expect(modal.getByText(/No shopping list yet/)).toBeVisible();

    await modal.getByPlaceholder('Add an item…').fill(shoppingItem);
    await modal.getByRole('button', { name: 'Add item' }).click();
    await expect(modal.getByText(shoppingItem)).toBeVisible();

    // Check it off — the progress counter reflects it
    await modal.getByRole('checkbox').first().check();
    await expect(modal.getByText('1/1')).toBeVisible();

    // Close and reopen — the list is persisted server-side against the menu
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal.getByText('Shopping List')).not.toBeVisible();
    await page.getByRole('button', { name: 'Shopping list' }).click();
    await expect(modal.getByText(shoppingItem)).toBeVisible();
    await expect(modal.getByRole('checkbox').first()).toBeChecked();

    // Remove the item and close
    await modal.getByRole('button', { name: `Remove ${shoppingItem}` }).click();
    await expect(modal.getByText(/No shopping list yet/)).toBeVisible();
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal.getByText('Shopping List')).not.toBeVisible();

    // ── 11. Log a single meal, then the rest of the day ───────────────────────
    await mealRow(todayCard, addedDesc).getByRole('button', { name: 'Log', exact: true }).click();
    await expect(mealRow(todayCard, addedDesc).getByText('✓ Logged')).toBeVisible({ timeout: 8_000 });
    // 1 of 2 meals logged → progress badge on the day header
    await expect(todayCard.getByText('1/2')).toBeVisible();

    await todayCard.getByRole('button', { name: /log full day/i }).click();
    await expect(todayCard.getByText('✓ Full day logged')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Adherence')).toBeVisible();

    // ── 12. Logged meals appear on the Today page ──────────────────────────────
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    const desktop = page.locator('[data-layout="desktop"]');
    await expect(desktop.getByText(addedDesc)).toBeVisible({ timeout: 8_000 });
    await expect(desktop.getByText(swappedDesc)).toBeVisible();

    // ── 13. Second menu (next week) → week navigation ──────────────────────────
    const nextMonday = shiftWeek(monday, 1);
    const nextWeekDesc = uniqueDesc('Next week lunch');
    await page.request.post('/api/calories/menu', {
      data: {
        weekStart: nextMonday,
        meals: [{ dayOfWeek: 0, mealType: 'lunch', description: nextWeekDesc, kcal: 700 }],
      },
    });
    await page.goto('/calories/menu');
    await page.waitForLoadState('networkidle');

    // Current week is auto-selected; logged state survived the reload (server persistence)
    await expect(page.getByText('1 / 2')).toBeVisible();
    await expect(todayCard.getByText('✓ Full day logged')).toBeVisible();

    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await expectSelectedWeek(page, nextMonday);
    await expect(page.locator('[data-day="0"]').getByText(nextWeekDesc)).toBeVisible();
    // Future week: logging is not available
    await expect(page.getByText('Log full day ✓')).toHaveCount(0);

    await page.getByRole('button', { name: 'Previous week' }).click();
    await expectSelectedWeek(page, monday);
    await expect(todayCard.getByText(swappedDesc)).toBeVisible();

    // ── 14. Delete both menus → back to empty state ────────────────────────────
    await page.getByRole('button', { name: 'Next week' }).click();
    await expectSelectedWeek(page, nextMonday);
    await page.getByRole('button', { name: 'Delete menu' }).click();
    await expect(page.getByText('Delete this weekly menu?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    // Remaining menu is re-selected after deletion
    await expect(page.getByText('1 / 1')).toBeVisible({ timeout: 8_000 });
    await expectSelectedWeek(page, monday);

    await page.getByRole('button', { name: 'Delete menu' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('No weekly menus yet')).toBeVisible({ timeout: 8_000 });
  });
});
