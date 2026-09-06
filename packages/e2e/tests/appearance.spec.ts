import { test, expect, type Page } from '@playwright/test';

/** The Appearance card on the Profile page. */
const appearanceSection = (page: Page) =>
  page.getByRole('heading', { name: /appearance/i }).locator('xpath=ancestor::section[1]');

/** The picker block under one scope label ("Everything", "Travel", …) inside the Appearance card. */
const scopeRow = (page: Page, label: string) =>
  appearanceSection(page)
    .locator('p', { hasText: new RegExp(`^${label}$`, 'i') })
    .locator('xpath=following-sibling::div[1]/parent::div');

/** The theme class currently applied to a feature's wrapper, e.g. "ocean-deep-theme". */
async function featureThemeClass(page: Page, feature: string): Promise<string> {
  const el = page.locator(`[data-feature="${feature}"]`).first();
  await expect(el).toBeVisible();
  const className = (await el.getAttribute('class')) ?? '';
  return className.split(/\s+/).find(c => c.endsWith('-theme')) ?? '';
}

test.describe('Appearance themes', () => {
  test.beforeEach(async ({ page }) => {
    // Start from a known state: no stored overrides at all.
    for (const scope of ['global', 'travel', 'finances', 'calories']) {
      await page.request.put('/api/user/theme-preferences', { data: { scope, themeKey: null } });
    }
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    for (const scope of ['global', 'travel', 'finances', 'calories']) {
      await page.request.put('/api/user/theme-preferences', { data: { scope, themeKey: null } });
    }
  });

  /**
   * The default state must be the palettes the app shipped with, so an untouched account sees
   * no visual change from this feature at all.
   */
  test('defaults to each feature’s signature palette', async ({ page }) => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    expect(await featureThemeClass(page, 'finances')).toBe('finances-theme');

    await page.goto('/travel');
    await page.waitForLoadState('networkidle');
    expect(await featureThemeClass(page, 'travel')).toBe('travel-theme');
  });

  /**
   * Full round trip: pick a global theme, confirm it reaches a feature, survives a reload
   * (i.e. it is server-rendered from the DB, not just client state), then override that one
   * feature and confirm the override wins and can be cleared back to inheritance.
   */
  test('applies a global theme, persists it, and honours a per-feature override', async ({ page }) => {
    // ── 1. Pick a global hue and depth ────────────────────────────────────────
    const everything = scopeRow(page, 'Everything');
    await everything.getByRole('button', { name: 'Ocean' }).click();
    await everything.getByRole('button', { name: 'Deep' }).click();
    await page.waitForResponse(r => r.url().includes('/api/user/theme-preferences') && r.request().method() === 'PUT');

    // ── 2. It reaches a feature, and survives a reload ────────────────────────
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    expect(await featureThemeClass(page, 'finances')).toBe('ocean-deep-theme');

    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await featureThemeClass(page, 'finances')).toBe('ocean-deep-theme');

    // ── 3. A feature override beats the global choice ─────────────────────────
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    const finances = scopeRow(page, 'Finances');
    await finances.getByRole('button', { name: 'Rose' }).click();
    await page.waitForResponse(r => r.url().includes('/api/user/theme-preferences') && r.request().method() === 'PUT');

    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    expect(await featureThemeClass(page, 'finances')).toBe('rose-classic-theme');

    // Travel, which has no override of its own, still follows the global choice.
    await page.goto('/travel');
    await page.waitForLoadState('networkidle');
    expect(await featureThemeClass(page, 'travel')).toBe('ocean-deep-theme');

    // ── 4. Clearing the override restores inheritance ─────────────────────────
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await scopeRow(page, 'Finances')
      .getByRole('button', { name: /same as everything/i })
      .click();
    await page.waitForResponse(r => r.url().includes('/api/user/theme-preferences') && r.request().method() === 'PUT');

    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    expect(await featureThemeClass(page, 'finances')).toBe('ocean-deep-theme');
  });

  /**
   * The theme must be on the very first server-rendered HTML — a client-side application would
   * flash the default palette before correcting itself.
   */
  test('server-renders the chosen theme with no flash of the default', async ({ page }) => {
    await page.request.put('/api/user/theme-preferences', {
      data: { scope: 'global', themeKey: 'fuchsia-deep' },
    });

    const response = await page.goto('/todo');
    const html = (await response?.text()) ?? '';
    expect(html).toContain('fuchsia-deep-theme');
    expect(html).not.toContain('graphite-theme');
  });

  /** Invalid keys must be rejected rather than stored and later rendered as a bogus class. */
  test('rejects an unknown theme key', async ({ page }) => {
    const res = await page.request.put('/api/user/theme-preferences', {
      data: { scope: 'global', themeKey: 'not-a-theme' },
    });
    expect(res.status()).toBe(400);
  });
});
