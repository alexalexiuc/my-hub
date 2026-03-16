import type { Page } from '@playwright/test';

/** Wipe all data for the authenticated test user (uses page's auth cookies). */
export async function deleteAllData(page: Page): Promise<void> {
  await page.request.post('/api/user/delete-all');
}

/** Wipe only specific data features. */
export async function deleteFeatures(
  page: Page,
  features: ('meals' | 'measurements' | 'calories_profile' | 'todos')[],
): Promise<void> {
  await page.request.post('/api/user/delete-data', { data: { features } });
}
