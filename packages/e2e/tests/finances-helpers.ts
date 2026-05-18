import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Wipe all finances data for the authenticated test user. */
export async function deleteFinances(page: Page) {
  await page.request.post('/api/user/delete-data', { data: { features: ['finances'] } });
}

/** Create a budget via the UI form (assumes no budget exists yet). */
export async function createBudgetViaUI(page: Page, name: string) {
  await expect(page.getByRole('button', { name: 'Create budget' })).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder('e.g. Household, Personal…').fill(name);
  await page.getByRole('button', { name: 'Create budget' }).click();
  await page.waitForLoadState('networkidle');
}

/** Create a budget via the API (faster, for setup steps). */
export async function createBudgetViaAPI(page: Page, name: string, currency = 'EUR') {
  const res = await page.request.post('/api/finances/budgets', {
    data: { name, defaultCurrency: currency },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { budget: { id: number } };
  return body.budget.id;
}

/** Create a category via the API. */
export async function createCategoryViaAPI(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/finances/categories', { data: { name } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: number };
  return body.id;
}

/** Create a group via the API. */
export async function createGroupViaAPI(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/finances/groups', { data: { name } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: number };
  return body.id;
}

/** Add an expense transaction via the API (requires an existing account and category). */
export async function createTransactionViaAPI(
  page: Page,
  accountId: number,
  categoryId: number,
  amount = 50,
): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const res = await page.request.post('/api/finances/transactions', {
    data: { type: 'expense', accountId, categoryId, amount, date },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { transaction: { id: number } };
  return body.transaction.id;
}

/** Create an account via the API. */
export async function createAccount(
  page: Page,
  data: { name: string; type: string; currency?: string; openingBalance?: number; details?: object },
) {
  const res = await page.request.post('/api/finances/accounts', {
    data: { currency: 'EUR', openingBalance: 0, ...data },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { account: { id: number; name: string } };
  return body.account;
}

export async function ensureUserExists(page: Page, email: string, password: string, name: string) {
  const res = await page.request.post('/api/auth/register', {
    data: { email, password, name },
  });
  // 201=created, 409=already exists; 403=invite-only registration (user may be pre-seeded)
  expect([201, 403, 409]).toContain(res.status());
}
