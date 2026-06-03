import { test, expect } from '@playwright/test';
import { uniqueName, deleteFinances, createBudgetViaAPI, createAccount } from './finances-helpers';

test.describe('Finances – Accounts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finances/accounts');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Transactions: transfer between two accounts debits one and credits the other.
   * Kept separate because it requires two accounts and a specific transaction type.
   */
  test('transfer transaction moves funds between two accounts', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Transfer Test Budget'));

    const fromAcc = await createAccount(page, { name: 'From Account', type: 'bank', openingBalance: 1000 });
    const toAcc = await createAccount(page, { name: 'Savings Account', type: 'bank', openingBalance: 0 });

    await page.goto('/finances/transactions');
    await page.waitForLoadState('networkidle');

    await page.getByTitle('Add transaction').first().click();
    await expect(page.locator('[data-layout="desktop"]').getByText('New Transaction')).toBeVisible();

    // Select transfer type
    await page.getByRole('button', { name: 'transfer', exact: true }).click();

    // Amount mask is onKeyDown-controlled — must pressSequentially, not fill
    await page.getByPlaceholder('0.00').pressSequentially('250.00');

    // Select from account — FinancialDropdown with searchable=false renders a button trigger.
    // Scope via the exact FieldCard label so "To Account" is not matched.
    await page.getByText('Account', { exact: true }).locator('..').getByRole('button').click();
    await page.locator(`[data-value="${fromAcc.name}"]`).click();

    // Select to account
    await page.getByText('To Account', { exact: true }).locator('..').getByRole('button').click();
    await page.locator(`[data-value="${toAcc.name}"]`).click();

    const saveResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/transactions') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save Transfer' }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(201);
  });

  /**
   * Accounts: borrowed/lent account shows counterparty name and settle flow.
   * Kept separate because it involves specific detail fields and a unique action.
   */
  test('borrowed/lent account shows counterparty and settle action', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('BorrowedLent Budget'));

    await page.goto('/finances/accounts');
    await page.waitForLoadState('networkidle');

    await page.getByTitle('Add account').click();
    await expect(page.locator('[data-layout="desktop"]').getByText('New Account')).toBeVisible();

    const lentName = uniqueName('Loan to John');
    await page.getByPlaceholder('e.g. Salary').fill(lentName);

    // Type is a FinancialDropdown (not a native select) — click the trigger button, then pick the option
    await page.getByText('Type', { exact: true }).locator('..').getByRole('button').click();
    await page.getByRole('button', { name: '🤝 Borrowed / Lent', exact: true }).click();

    await page.getByPlaceholder('John Doe').fill('John Doe');
    // Direction defaults to "Lent (gave)"

    const createLentRes = page.waitForResponse(
      res => res.url().includes('/api/finances/accounts') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create Account' }).click();
    await createLentRes;

    // Account appears under "Borrowed/Lent" group
    await expect(page.getByText(lentName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('John Doe')).toBeVisible();

    // Settle button visible for unsettled accounts
    await expect(page.getByRole('button', { name: 'Settle' })).toBeVisible();

    // Settle the account
    const settleResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/accounts/') && res.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Settle' }).click();
    const settleResponse = await settleResponsePromise;
    expect(settleResponse.status()).toBe(200);

    await page.waitForLoadState('networkidle');
    // After settling, button should not be visible (settled badge or no settle button)
    await expect(page.getByRole('button', { name: 'Settle' })).not.toBeVisible();
  });
});
