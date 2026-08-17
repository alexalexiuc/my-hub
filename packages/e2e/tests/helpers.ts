import type { Page, Locator } from '@playwright/test';

/**
 * The label of a `PeriodNav` stepper, scoped through its own buttons. Short labels like
 * "This week" also appear as chart headings, so a bare text locator matches twice — and both the
 * Progress and Reports screens drive the same component, so the locator has one owner.
 */
export function periodLabel(page: Page): Locator {
  return page.getByRole('button', { name: 'Next period' }).locator('xpath=preceding-sibling::span[1]');
}

/** Wipe all data for the authenticated test user (uses page's auth cookies). */
export async function deleteAllData(page: Page): Promise<void> {
  await page.request.post('/api/user/delete-all');
}

/** Wipe only specific data features. */
export async function deleteFeatures(
  page: Page,
  features: ('meals' | 'measurements' | 'calories_profile' | 'todos' | 'my_travels' | 'weekly_menus')[],
): Promise<void> {
  await page.request.post('/api/user/delete-data', { data: { features } });
}
