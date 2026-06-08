import { test, expect } from '@playwright/test';
import {
  uniqueName,
  deleteFinances,
  createBudgetViaAPI,
  createAccount,
  createCategoryViaAPI,
} from './finances-helpers';

test.describe('Finances - Transactions Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finances/transactions');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Filter panel: type, account, category, label, amount range, and notes search
   * each narrow the transaction list independently, and "Clear all filters" resets
   * the list back to showing everything.
   */
  test('transactions: filter panel narrows results by type, account, category, label, amount, and notes', async ({
    page,
  }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Filter Test Budget'));

    const checking = await createAccount(page, { name: uniqueName('Checking'), type: 'bank', openingBalance: 2000 });
    const savings = await createAccount(page, { name: uniqueName('Savings'), type: 'bank', openingBalance: 5000 });
    const groceriesCatName = uniqueName('Groceries');
    const salaryCatName = uniqueName('Salary');
    const groceriesCatId = await createCategoryViaAPI(page, groceriesCatName);
    const salaryCatId = await createCategoryViaAPI(page, salaryCatName);

    const today = new Date().toISOString().slice(0, 10);
    const superMart = uniqueName('SuperMart');
    const bulkBuy = uniqueName('Bulk Buy');
    const employer = uniqueName('Employer Inc');

    // Three transactions spanning both accounts/categories/types, with distinct
    // amounts, notes, and labels so each filter dimension can be exercised alone.
    await page.request.post('/api/finances/transactions', {
      data: {
        type: 'expense',
        accountId: checking.id,
        categoryId: groceriesCatId,
        amount: 45.5,
        date: today,
        payeeName: superMart,
        notes: 'Weekly groceries run',
        labels: ['Essential'],
      },
    });
    await page.request.post('/api/finances/transactions', {
      data: {
        type: 'expense',
        accountId: savings.id,
        categoryId: groceriesCatId,
        amount: 120,
        date: today,
        payeeName: bulkBuy,
        notes: 'Stock up for the month',
      },
    });
    await page.request.post('/api/finances/transactions', {
      data: {
        type: 'income',
        accountId: savings.id,
        categoryId: salaryCatId,
        amount: 2500,
        date: today,
        payeeName: employer,
        notes: 'June paycheck',
        labels: ['Recurring'],
      },
    });

    await page.goto('/finances/transactions');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTitle(superMart)).toBeVisible();
    await expect(page.getByTitle(bulkBuy)).toBeVisible();
    await expect(page.getByTitle(employer)).toBeVisible();

    await page.getByRole('button', { name: 'Toggle filters' }).click();
    await expect(page.getByText('Search notes', { exact: true })).toBeVisible();

    // ── 1. Type filter ────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Expenses', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTitle(superMart)).toBeVisible();
    await expect(page.getByTitle(bulkBuy)).toBeVisible();
    await expect(page.getByTitle(employer)).not.toBeVisible();

    await page.getByRole('button', { name: 'Income', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTitle(employer)).toBeVisible();
    await expect(page.getByTitle(superMart)).not.toBeVisible();
    await expect(page.getByTitle(bulkBuy)).not.toBeVisible();

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // ── 2. Account filter ─────────────────────────────────────────────────
    await page.getByPlaceholder('All accounts').click();
    await page.locator(`button[data-value="${checking.name}"]`).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTitle(superMart)).toBeVisible();
    await expect(page.getByTitle(bulkBuy)).not.toBeVisible();
    await expect(page.getByTitle(employer)).not.toBeVisible();

    await page.getByRole('button', { name: 'Clear account filter' }).click();
    await page.waitForLoadState('networkidle');

    // ── 3. Category filter ────────────────────────────────────────────────
    await page.getByPlaceholder('All categories').click();
    await page.locator(`button[data-value="${salaryCatName}"]`).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTitle(employer)).toBeVisible();
    await expect(page.getByTitle(superMart)).not.toBeVisible();
    await expect(page.getByTitle(bulkBuy)).not.toBeVisible();

    await page.getByRole('button', { name: 'Clear category filter' }).click();
    await page.waitForLoadState('networkidle');

    // ── 4. Label filter ───────────────────────────────────────────────────
    await page.getByText('Label', { exact: true }).locator('..').getByRole('button').first().click();
    await page.locator('button[data-value="Essential"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTitle(superMart)).toBeVisible();
    await expect(page.getByTitle(bulkBuy)).not.toBeVisible();
    await expect(page.getByTitle(employer)).not.toBeVisible();

    await page.getByRole('button', { name: 'Clear label filter' }).click();
    await page.waitForLoadState('networkidle');

    // ── 5. Amount range filter ────────────────────────────────────────────
    const minAmountInput = page.getByText('Min amount', { exact: true }).locator('..').getByRole('spinbutton');
    const maxAmountInput = page.getByText('Max amount', { exact: true }).locator('..').getByRole('spinbutton');

    const minAmountApi = page.waitForResponse(res => res.url().includes('amountGte=100'));
    await minAmountInput.fill('100');
    await minAmountApi;
    // Excludes SuperMart (45.50); keeps Bulk Buy (120) and Employer (2500)
    await expect(page.getByTitle(superMart)).not.toBeVisible();
    await expect(page.getByTitle(bulkBuy)).toBeVisible();
    await expect(page.getByTitle(employer)).toBeVisible();

    const maxAmountApi = page.waitForResponse(res => res.url().includes('amountLte=200'));
    await maxAmountInput.fill('200');
    await maxAmountApi;
    // Narrows to only Bulk Buy (120), between 100 and 200
    await expect(page.getByTitle(bulkBuy)).toBeVisible();
    await expect(page.getByTitle(superMart)).not.toBeVisible();
    await expect(page.getByTitle(employer)).not.toBeVisible();

    await minAmountInput.fill('');
    await maxAmountInput.fill('');
    await page.waitForLoadState('networkidle');

    // ── 6. Search notes ───────────────────────────────────────────────────
    const searchApi = page.waitForResponse(res => res.url().includes('search=paycheck'));
    await page.getByPlaceholder('Search in memo…').fill('paycheck');
    await searchApi;
    await expect(page.getByTitle(employer)).toBeVisible();
    await expect(page.getByTitle(superMart)).not.toBeVisible();
    await expect(page.getByTitle(bulkBuy)).not.toBeVisible();

    // ── 7. Clear all filters resets the list ──────────────────────────────
    await expect(page.getByRole('button', { name: 'Clear all filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTitle(superMart)).toBeVisible();
    await expect(page.getByTitle(bulkBuy)).toBeVisible();
    await expect(page.getByTitle(employer)).toBeVisible();
  });
});
