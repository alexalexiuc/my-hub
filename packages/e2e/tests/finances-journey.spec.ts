import { test, expect } from '@playwright/test';
import {
  uniqueName,
  deleteFinances,
  createBudgetViaUI,
  createBudgetViaAPI,
  createAccount,
  createCategoryViaAPI,
} from './finances-helpers';

test.describe('Finances – Journey', () => {
  // Outer serial ensures the standalone month-nav test (which calls deleteFinances)
  // runs after the inner serial block, not concurrently in a separate worker.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Full finances journey: accounts, transactions, categories, goals, settings.
   * Covers all main navigation paths (the "district") of the finances feature.
   * Tests run serially and share the same budget created in the first test.
   */
  test.describe('full finances journey: accounts, transactions, categories, goals, settings', () => {
    test.describe.configure({ mode: 'serial' });

    const bankAccountName = uniqueName('Main Checking');
    const ccName = uniqueName('Visa Card');
    const goalName = uniqueName('Emergency Fund');
    const groupName = uniqueName('Living Expenses');
    const catName = uniqueName('Groceries');

    test('create budget', async ({ page }) => {
      await deleteFinances(page);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await createBudgetViaUI(page, uniqueName('E2E Journey Budget'));

      // Dashboard is shown after budget creation (sidebar re-fetches on full reload only;
      // verifying dashboard content is sufficient to confirm the budget was activated).
      await expect(page.getByText('This Month', { exact: true })).toBeVisible({ timeout: 30_000 });
    });

    test('accounts: add bank account, credit card, and goal', async ({ page }) => {
      // ── 1. Add bank account ───────────────────────────────────────────────
      await page.getByRole('button', { name: 'Accounts' }).click();
      await page.waitForLoadState('networkidle');

      await page.getByTitle('Add account').click();
      await expect(page.locator('[data-layout="desktop"]').getByText('New Account')).toBeVisible();

      // Use exact: true to avoid matching "Card Name (optional)" which also contains "Name"
      await page.getByLabel('Name', { exact: true }).fill(bankAccountName);
      // Type defaults to bank — opening balance
      await page.getByLabel('Opening Balance').fill('1500');
      const createBankRes = page.waitForResponse(
        res => res.url().includes('/api/finances/accounts') && res.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Create Account' }).click();
      await createBankRes;

      await expect(page.getByText(bankAccountName)).toBeVisible({ timeout: 10_000 });

      // ── 2. Add credit card ────────────────────────────────────────────────
      await page.getByTitle('Add account').click();
      await page.getByLabel('Name', { exact: true }).fill(ccName);
      await page.getByLabel('Type').click();
      await page.getByRole('button', { name: '💳 Credit Card', exact: true }).click();
      await page.getByLabel('Credit Limit').fill('5000');
      await page.getByLabel('Opening Balance').fill('200');
      const createCcRes = page.waitForResponse(
        res => res.url().includes('/api/finances/accounts') && res.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Create Account' }).click();
      await createCcRes;

      await expect(page.getByText(ccName)).toBeVisible({ timeout: 10_000 });
      // Credit card shows progress bar (used / limit)
      await expect(page.getByText(/Used/i)).toBeVisible();

      // ── 3. Add goal account ───────────────────────────────────────────────
      await page.getByTitle('Add account').click();
      await page.getByLabel('Name', { exact: true }).fill(goalName);
      await page.getByLabel('Type').click();
      await page.getByRole('button', { name: '🎯 Goal', exact: true }).click();
      await page.getByLabel('Target Amount').fill('10000');
      await page.getByLabel('Opening Balance').fill('500');
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(goalName)).toBeVisible();
    });

    test('account detail: shows initial balance transaction', async ({ page }) => {
      const accountsRes = await page.request.get('/api/finances/accounts');
      const accountsData = (await accountsRes.json()) as { accounts: Array<{ id: number; name: string }> };
      const bankAcc = accountsData.accounts.find(a => a.name === bankAccountName);
      expect(bankAcc).toBeTruthy();

      await page.goto(`/finances/accounts/${bankAcc!.id}`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(bankAccountName).first()).toBeVisible();
      await expect(page.getByTitle('Initial Balance')).toBeVisible();
    });

    test('account edit: rename and update details succeeds without validation error', async ({ page }) => {
      const accountsRes = await page.request.get('/api/finances/accounts');
      const accountsData = (await accountsRes.json()) as {
        accounts: Array<{ id: number; name: string; type: string }>;
      };

      // ── 1. Edit bank account (name rename) ────────────────────────────────
      const bankAcc = accountsData.accounts.find(a => a.name === bankAccountName);
      expect(bankAcc).toBeTruthy();

      await page.goto(`/finances/accounts/${bankAcc!.id}`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Edit account' }).click();
      await expect(page.locator('[data-layout="desktop"]').getByText('Edit Account')).toBeVisible();

      const newBankName = `${bankAccountName} Renamed`;
      await page.getByLabel('Name', { exact: true }).fill(newBankName);

      const editBankRes = page.waitForResponse(
        res => res.url().includes(`/api/finances/accounts/${bankAcc!.id}`) && res.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Save Changes' }).click();
      const editBankResp = await editBankRes;
      expect(editBankResp.status()).toBe(200);
      await expect(page.getByText(newBankName)).toBeVisible({ timeout: 10_000 });

      // ── 2. Edit credit card account (update credit limit) ─────────────────
      const ccAcc = accountsData.accounts.find(a => a.name === ccName);
      expect(ccAcc).toBeTruthy();

      await page.goto(`/finances/accounts/${ccAcc!.id}`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Edit account' }).click();
      await expect(page.locator('[data-layout="desktop"]').getByText('Edit Account')).toBeVisible();

      await page.getByLabel('Credit Limit').fill('7500');

      const editCcRes = page.waitForResponse(
        res => res.url().includes(`/api/finances/accounts/${ccAcc!.id}`) && res.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Save Changes' }).click();
      const editCcResp = await editCcRes;
      expect(editCcResp.status()).toBe(200);

      // ── 3. Edit goal account (update target amount) ───────────────────────
      const goalAcc = accountsData.accounts.find(a => a.name === goalName);
      expect(goalAcc).toBeTruthy();

      await page.goto(`/finances/accounts/${goalAcc!.id}`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Edit account' }).click();
      await expect(page.locator('[data-layout="desktop"]').getByText('Edit Account')).toBeVisible();

      await page.getByLabel('Target Amount').fill('15000');

      const editGoalRes = page.waitForResponse(
        res => res.url().includes(`/api/finances/accounts/${goalAcc!.id}`) && res.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Save Changes' }).click();
      const editGoalResp = await editGoalRes;
      expect(editGoalResp.status()).toBe(200);
    });

    test('transactions: add expense and payee autocomplete', async ({ page }) => {
      // Expense form requires a category — create one via API before opening the modal
      const expenseCatName = uniqueName('Shopping');
      await createCategoryViaAPI(page, expenseCatName);

      await page.getByRole('button', { name: 'Transactions' }).click();
      await page.waitForLoadState('networkidle');

      // ── 1. Add expense ────────────────────────────────────────────────────
      await page.getByTitle('Add transaction').first().click();
      await expect(page.locator('[data-layout="desktop"]').getByText('New Transaction')).toBeVisible();

      // Default type is expense — fill in amount, account, category, and payee
      // Amount mask is onKeyDown-controlled — must pressSequentially, not fill
      await page.getByPlaceholder('0.00').pressSequentially('45.50');
      // Select account
      await page.getByText('Account', { exact: true }).locator('..').getByRole('button').click();
      await page.getByRole('button', { name: bankAccountName }).first().click();
      // Select category (required for expenses)
      await page.getByText('Category', { exact: true }).locator('..').getByRole('button').click();
      await page.getByRole('button', { name: expenseCatName }).first().click();
      await page.getByPlaceholder('e.g. Kaufland, Netflix…').fill('Supermarket');
      await page.getByRole('button', { name: 'Create "Supermarket"' }).click();
      await page.getByRole('button', { name: 'Save Expense' }).click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByTitle('Supermarket')).toBeVisible();

      // ── 2. Payee autocomplete: pill and fuzzy-search suggestions ──────────
      // "Supermarket" was just saved, so it should appear as a most-used pill and
      // as a fuzzy-search result when typing a partial name.
      await page.getByTitle('Add transaction').first().click();
      await expect(page.locator('[data-layout="desktop"]').getByText('New Transaction')).toBeVisible();

      // Most-used payee pill appears without typing anything
      await expect(page.getByRole('button', { name: 'Supermarket' })).toBeVisible();

      // Fuzzy search: typing a prefix narrows the dropdown
      await page.getByPlaceholder('e.g. Kaufland, Netflix…').fill('Super');
      await expect(page.getByRole('button', { name: 'Supermarket' }).first()).toBeVisible();

      // Clicking the suggestion fills the payee field
      await page.getByRole('button', { name: 'Supermarket' }).first().click();
      await expect(page.getByPlaceholder('e.g. Kaufland, Netflix…')).toHaveValue('Supermarket');

      // Close modal without saving
      await page.getByRole('button', { name: 'Cancel' }).click();
    });

    test('transactions: add income and filter by type', async ({ page }) => {
      await page.getByRole('button', { name: 'Transactions' }).click();
      await page.waitForLoadState('networkidle');

      // ── 1. Add income ─────────────────────────────────────────────────────
      await page.getByTitle('Add transaction').first().click();
      await expect(page.locator('[data-layout="desktop"]').getByText('New Transaction')).toBeVisible();

      await page.getByRole('button', { name: 'income', exact: true }).click();
      // Amount mask is onKeyDown-controlled — must pressSequentially, not fill
      await page.getByPlaceholder('0.00').pressSequentially('2000.00');
      await page.getByRole('button', { name: 'Choose…' }).first().click();
      await page.getByRole('button', { name: bankAccountName }).first().click();
      await page.getByPlaceholder('e.g. Kaufland, Netflix…').fill('Employer');
      await page.getByRole('button', { name: 'Create "Employer"' }).click();
      await page.getByRole('button', { name: 'Save Income' }).click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByTitle('Employer')).toBeVisible();

      // ── 2. Filter by type ─────────────────────────────────────────────────
      await page.getByRole('button', { name: 'Expenses', exact: true }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTitle('Supermarket')).toBeVisible();
      await expect(page.getByTitle('Employer')).not.toBeVisible();

      await page.getByRole('button', { name: 'Income', exact: true }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTitle('Employer')).toBeVisible();
      await expect(page.getByTitle('Supermarket')).not.toBeVisible();

      await page.getByRole('button', { name: 'All', exact: true }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTitle('Supermarket')).toBeVisible();
      await expect(page.getByTitle('Employer')).toBeVisible();
    });

    test('categories: add group and category', async ({ page }) => {
      await page.getByRole('button', { name: 'Categories' }).click();
      await page.waitForLoadState('networkidle');

      // ── 1. Add group via the "+ New Group" button at the bottom of the page ─
      await page.getByRole('button', { name: '+ New Group' }).click();
      await expect(page.locator('[data-layout="desktop"]').getByText('New Group', { exact: true })).toBeVisible();

      await page.getByLabel('Name').fill(groupName);
      await page.getByRole('button', { name: 'Create' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(groupName)).toBeVisible();

      // ── 2. Add category via the group's "+ Add category" button (inside the card) ─
      await page.getByRole('button', { name: '+ Add category', exact: true }).click();
      await expect(page.locator('[data-layout="desktop"]').getByText('New Category')).toBeVisible();

      await page.getByLabel('Name').fill(catName);
      await page.getByTitle('Groceries').click(); // select 🛒 icon
      await page.getByLabel('Monthly Target (optional)').fill('400');
      await page.getByRole('button', { name: 'Create' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-layout="desktop"]').getByText(catName)).toBeVisible();
      // Shows "Target amount/mo" label in the category row
      await expect(page.locator('[data-layout="desktop"]').getByText(/Target.*\/mo/)).toBeVisible();
    });

    test('goals: goal account appears on goals page', async ({ page }) => {
      await page.getByRole('button', { name: 'Goals' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(goalName).first()).toBeVisible();
    });

    test('dashboard: monthly income and expense figures shown', async ({ page }) => {
      await page.getByRole('button', { name: 'Dashboard' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Available', { exact: true })).toBeVisible();
      await expect(page.getByText('This Month', { exact: true })).toBeVisible();
      await expect(page.getByText('Income')).toBeVisible();
      await expect(page.getByText('Expenses')).toBeVisible();
      await expect(page.getByText('Recent')).toBeVisible();
    });

    test('categories: edit group name inline and edit category details', async ({ page }) => {
      await page.getByRole('button', { name: 'Categories' }).click();
      await page.waitForLoadState('networkidle');

      // ── 1. Rename the group via inline edit ───────────────────────────────────
      // force: true bypasses the opacity-0 on the hover-revealed edit button
      await page.getByRole('button', { name: `Edit group ${groupName}` }).click({ force: true });

      // Input appears pre-filled with the current group name; it's the only textbox visible
      const editedGroupName = `${groupName} Renamed`;
      const nameInput = page.getByRole('textbox').first();
      await nameInput.clear();
      await nameInput.fill(editedGroupName);

      const renameResponsePromise = page.waitForResponse(
        res => res.url().includes('/api/finances/groups/') && res.request().method() === 'PATCH',
      );
      await nameInput.press('Enter');
      const renameResponse = await renameResponsePromise;
      expect(renameResponse.status()).toBe(200);

      // Renamed label is visible; old name is gone
      await expect(page.getByText(editedGroupName)).toBeVisible();
      await expect(page.getByText(groupName, { exact: true })).not.toBeVisible();

      // ── 2. Edit the category via the pencil icon ─────────────────────────────
      await page.getByRole('button', { name: `Edit category ${catName}` }).click({ force: true });

      await expect(page.locator('[data-layout="desktop"]').getByText('Edit Category')).toBeVisible();

      // Update the monthly target to 600
      await page.getByLabel('Monthly Target (optional)').clear();
      await page.getByLabel('Monthly Target (optional)').fill('600');

      const patchResponsePromise = page.waitForResponse(
        res => res.url().includes('/api/finances/categories/') && res.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: 'Save' }).click();
      const patchResponse = await patchResponsePromise;
      expect(patchResponse.status()).toBe(200);

      await page.waitForLoadState('networkidle');

      // Updated target label appears in the category row
      await expect(page.locator('[data-layout="desktop"]').getByText(/Target.*600.*\/mo/)).toBeVisible();
    });
  });

  /**
   * Transactions: month navigation reloads data on first click.
   * Regression test for the bug where clicking the MonthCarousel only updated
   * the month label but did not reload transaction data until the following click
   * (caused by the API using a hardcoded day 31 for all months, which PostgreSQL
   * rejects for 30-day months, causing a silent API error on first navigation).
   */
  test('transactions: month navigation reloads data immediately on first click', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Month Nav Budget'));

    const bank = await createAccount(page, { name: 'Nav Test Bank', type: 'bank', openingBalance: 500 });
    const catId = await createCategoryViaAPI(page, uniqueName('Nav Category'));

    // Create a transaction dated today (current month)
    const today = new Date().toISOString().slice(0, 10);
    const txRes = await page.request.post('/api/finances/transactions', {
      data: { type: 'expense', accountId: bank.id, categoryId: catId, amount: 77, date: today },
    });
    expect(txRes.status()).toBe(201);

    await page.goto('/finances/transactions');
    await page.waitForLoadState('networkidle');

    // Scope amount assertions to the amount column of the desktop transaction row.
    // fmt() uses de-DE locale → "77,00 €"; using exact text to avoid false matches
    // on the category name timestamp which can also contain "77".
    const txAmountLocator = page
      .locator('[data-layout="desktop"]')
      .filter({ hasText: 'Nav Test Bank' })
      .locator('div.text-right')
      .getByText('77,00 €', { exact: true });

    // Current month shows the transaction (amount 77)
    await expect(txAmountLocator).toBeVisible();

    // Derive current and previous month labels for assertions
    const now = new Date();
    const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthLabel = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Navigate to previous month — a single click must trigger a successful API reload immediately
    const prevMonthApiPromise = page.waitForResponse(
      res => res.url().includes('/api/finances/transactions') && res.url().includes('month=') && res.ok(),
    );
    await page.getByLabel('Previous month').first().click();
    await prevMonthApiPromise;

    // Scope month label assertions to the desktop SmartDatePicker button (extendedFilters=true
    // renders a <button>, not <h2>) to avoid the mobile header (which uses <h2>) matching too.
    const desktopMonthLabel = page.locator('div.hidden.md\\:flex button').first();

    // Label has updated to previous month
    await expect(desktopMonthLabel).toHaveText(prevMonthLabel);

    // The current-month transaction must NOT be visible — data was actually reloaded
    await expect(txAmountLocator).not.toBeVisible();

    // Navigate back to current month via the "Today" button
    const todayApiPromise = page.waitForResponse(
      res => res.url().includes('/api/finances/transactions') && res.url().includes('month=') && res.ok(),
    );
    await page.getByRole('button', { name: 'Today' }).first().click();
    await todayApiPromise;

    await expect(desktopMonthLabel).toHaveText(currentMonthLabel);
    await expect(txAmountLocator).toBeVisible();
  });
});
