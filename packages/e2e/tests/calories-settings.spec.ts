import { test, expect, type Page } from '@playwright/test';
import { DAY_LABELS_SHORT } from '@my-hub/shared/constants';
import { dateToString, dayOfWeekMon0 } from '@my-hub/shared/utils';
import { deleteFeatures } from './helpers';

/**
 * Short weekday label for today, read from the same constants the gym-day chips are rendered
 * from — a local copy of the names and the Sun=0 → Mon=0 correction could keep passing while
 * the UI drifted away from it.
 */
function todayChipLabel(): string {
  return DAY_LABELS_SHORT[dayOfWeekMon0(dateToString(new Date()))];
}

/** The Profile card. Locators resolve lazily, so one instance keeps working across `page.reload()`. */
function profileCard(page: Page) {
  return page.getByText('Profile').locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

test.describe('Calories — Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calories/settings');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['calories_profile']);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('shows empty profile prompt and Edit button when no profile is set', async ({ page }) => {
    await expect(page.getByText(/set up your profile to get personalized/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible();
  });

  /**
   * Edit profile: fill core demographic fields, save, verify read-mode display.
   */
  test('saves profile fields and shows them in read mode', async ({ page }) => {
    const card = profileCard(page);

    // ── 1. Open edit mode ─────────────────────────────────────────────────────
    await card.getByRole('button', { name: /^edit$/i }).click();

    // ── 2. Fill in fields ─────────────────────────────────────────────────────
    await page.getByRole('spinbutton', { name: /^age$/i }).fill('28');
    await page.getByRole('combobox', { name: /^sex$/i }).selectOption('female');
    await page.getByRole('spinbutton', { name: /height/i }).fill('165');
    await page.getByRole('combobox', { name: /activity level/i }).selectOption('lightly_active');
    await page.getByRole('combobox', { name: /goal type/i }).selectOption('maintain');

    // ── 3. Save ───────────────────────────────────────────────────────────────
    await card.getByRole('button', { name: /^save$/i }).click();
    await expect(card.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // ── 4. Read mode shows saved values ───────────────────────────────────────
    await expect(card.getByText('28')).toBeVisible();
    await expect(card.getByText(/female/i)).toBeVisible();
  });

  /**
   * The weight entered here is stored as a measurement, not a profile column, but it is what
   * every calorie target depends on — so the journey runs from "no goal set" through entering a
   * weight to a real target, and on to the gym-day bonus that target carries on a training day.
   */
  test('weight entered in the profile unlocks targets, and a gym day adds its bonus', async ({ page }) => {
    await deleteFeatures(page, ['measurements', 'meals']);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = profileCard(page);

    // ── 1. Without a weigh-in, the Today page cannot show a target ─────────────
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/no goal set/i)).toBeVisible();

    // ── 2. Fill the profile, including weight, and mark today as a gym day ─────
    await page.goto('/calories/settings');
    await page.waitForLoadState('networkidle');
    await card.getByRole('button', { name: /^edit$/i }).click();

    await page.getByRole('spinbutton', { name: /^age$/i }).fill('34');
    await page.getByRole('combobox', { name: /^sex$/i }).selectOption('male');
    await page.getByRole('spinbutton', { name: /height/i }).fill('178');
    await page.getByRole('spinbutton', { name: /weight/i }).fill('78');
    await page.getByRole('combobox', { name: /activity level/i }).selectOption('sedentary');
    await page.getByRole('spinbutton', { name: /max calories/i }).fill('2000');
    await page.getByRole('spinbutton', { name: /gym day calorie bonus/i }).fill('300');
    await page.getByRole('button', { name: new RegExp(`^${todayChipLabel()}$`) }).click();

    await card.getByRole('button', { name: /^save$/i }).click();
    await expect(card.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // ── 3. The weight is now part of the profile summary ──────────────────────
    await expect(card.getByText(/78 kg/)).toBeVisible();

    // ── 4. Today shows the target, raised by the gym-day bonus ────────────────
    await page.goto('/calories');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/no goal set/i)).toBeHidden();
    await expect(page.getByText(/gym day · \+300 kcal/i)).toBeVisible({ timeout: 8_000 });
    // 2000 ceiling + 300 for training today.
    await expect(page.getByText('2300', { exact: false }).first()).toBeVisible();
  });

  /**
   * Separate test: requires a mid-test page reload to confirm server persistence.
   */
  test('goal fields persist across page reload', async ({ page }) => {
    const card = profileCard(page);

    await card.getByRole('button', { name: /^edit$/i }).click();
    await page.getByRole('spinbutton', { name: /^age$/i }).fill('35');
    await page.getByRole('combobox', { name: /^sex$/i }).selectOption('male');
    await page.getByRole('spinbutton', { name: /height/i }).fill('178');
    await page.getByRole('combobox', { name: /activity level/i }).selectOption('moderately_active');
    await page.getByRole('combobox', { name: /goal type/i }).selectOption('weight_loss');
    await page.getByRole('spinbutton', { name: /rate/i }).fill('0.5');
    await page.getByRole('spinbutton', { name: /min calories/i }).fill('1400');
    await page.getByRole('spinbutton', { name: /max calories/i }).fill('1900');
    await card.getByRole('button', { name: /^save$/i }).click();
    await expect(card.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // Reload to verify server persistence, not in-memory state.
    await page.reload();
    await page.waitForLoadState('networkidle');

    await card.getByRole('button', { name: /^edit$/i }).click();
    await expect(page.getByRole('spinbutton', { name: /^age$/i })).toHaveValue('35');
    await expect(page.getByRole('combobox', { name: /^sex$/i })).toHaveValue('male');
    await expect(page.getByRole('spinbutton', { name: /height/i })).toHaveValue('178');
    await expect(page.getByRole('combobox', { name: /activity level/i })).toHaveValue('moderately_active');
    await expect(page.getByRole('combobox', { name: /goal type/i })).toHaveValue('weight_loss');
    await expect(page.getByRole('spinbutton', { name: /rate/i })).toHaveValue('0.5');
    await expect(page.getByRole('spinbutton', { name: /min calories/i })).toHaveValue('1400');
    await expect(page.getByRole('spinbutton', { name: /max calories/i })).toHaveValue('1900');
  });

  /**
   * A quarter of a kilo per week is the usual recommendation for a lean gaining phase, and the
   * rate input's `step` used to be 0.1 — so the browser rejected 0.25 through native constraint
   * validation, which blocks submit *without* running the form's own resolver. Pressing Save did
   * nothing at all: no request, no error, no clue.
   *
   * Hence the two assertions. Leaving edit mode proves the submit was not swallowed; the value
   * surviving a reload proves it reached the server.
   */
  test('accepts a 0.25 kg/week rate, which the old step size rejected without saying so', async ({ page }) => {
    const card = profileCard(page);

    await card.getByRole('button', { name: /^edit$/i }).click();
    await page.getByRole('spinbutton', { name: /^age$/i }).fill('34');
    await page.getByRole('combobox', { name: /^sex$/i }).selectOption('male');
    await page.getByRole('spinbutton', { name: /height/i }).fill('178');
    await page.getByRole('combobox', { name: /activity level/i }).selectOption('moderately_active');
    await page.getByRole('combobox', { name: /goal type/i }).selectOption('weight_gain');
    await page.getByRole('spinbutton', { name: /rate/i }).fill('0.25');
    await card.getByRole('button', { name: /^save$/i }).click();

    // Back to read mode — the form actually submitted rather than being blocked by the browser.
    await expect(card.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await card.getByRole('button', { name: /^edit$/i }).click();
    await expect(page.getByRole('spinbutton', { name: /rate/i })).toHaveValue('0.25');
  });

  /**
   * Emptying a field has to clear it, not leave the old value behind.
   *
   * The form used to send an emptied note and a deselected goal as `undefined`, which
   * `JSON.stringify` drops from the body entirely — so the update never mentioned the column and
   * Drizzle left it untouched. The field came back on the next render, and nothing indicated the
   * save had ignored it.
   *
   * Every other profile test fills fields in; this is the only one that takes them back out, so
   * it is the only one that would notice.
   */
  test('clears notes and goal type instead of silently keeping the previous value', async ({ page }) => {
    const card = profileCard(page);

    // ── 1. Set a goal and a note ──────────────────────────────────────────────
    await card.getByRole('button', { name: /^edit$/i }).click();
    await page.getByRole('combobox', { name: /goal type/i }).selectOption('weight_loss');
    await page.getByRole('spinbutton', { name: /rate/i }).fill('0.5');
    await page.getByRole('textbox', { name: /notes/i }).fill('cutting phase');
    await card.getByRole('button', { name: /^save$/i }).click();
    await expect(card.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // ── 2. Empty both, using the select's own "no goal" option ────────────────
    await card.getByRole('button', { name: /^edit$/i }).click();
    await expect(page.getByRole('textbox', { name: /notes/i })).toHaveValue('cutting phase');
    await page.getByRole('textbox', { name: /notes/i }).fill('');
    await page.getByRole('combobox', { name: /goal type/i }).selectOption('');
    await card.getByRole('button', { name: /^save$/i }).click();
    await expect(card.getByRole('button', { name: /^edit$/i })).toBeVisible({ timeout: 5_000 });

    // ── 3. Reload: gone from the server, not just from local form state ───────
    await page.reload();
    await page.waitForLoadState('networkidle');
    await card.getByRole('button', { name: /^edit$/i }).click();
    await expect(page.getByRole('textbox', { name: /notes/i })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: /goal type/i })).toHaveValue('');
  });
});
