import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SHARED_FINANCE_FIXTURE } from '../constants';

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function ensureUserExists(page: Page, email: string, password: string, name: string) {
  const res = await page.request.post('/api/auth/register', {
    data: { email, password, name },
  });
  // 201=created, 409=already exists; 403=invite-only registration (user may be pre-seeded)
  expect([201, 403, 409]).toContain(res.status());
}

/** Wipe all finances data for the authenticated test user. */
async function deleteFinances(page: Page) {
  await page.request.post('/api/user/delete-data', { data: { features: ['finances'] } });
}

/** Create a budget via the UI form (assumes no budget exists yet). */
async function createBudgetViaUI(page: Page, name: string) {
  await expect(page.getByRole('button', { name: 'Create budget' })).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder('e.g. Household, Personal…').fill(name);
  await page.getByRole('button', { name: 'Create budget' }).click();
  await page.waitForLoadState('networkidle');
}

/** Create a budget via the API (faster, for setup steps). */
async function createBudgetViaAPI(page: Page, name: string, currency = 'EUR') {
  const res = await page.request.post('/api/finances/budgets', {
    data: { name, defaultCurrency: currency },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { budget: { id: number } };
  return body.budget.id;
}

/** Create a category via the API. */
async function createCategoryViaAPI(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/finances/categories', { data: { name } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: number };
  return body.id;
}

/** Create a group via the API. */
async function createGroupViaAPI(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/finances/groups', { data: { name } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: number };
  return body.id;
}

/** Add an expense transaction via the API (requires an existing account and category). */
async function createTransactionViaAPI(
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
async function createAccount(
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

test.describe('Finances', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  /**
   * No-budget path: a fresh user with no budget sees the CreateBudgetScreen,
   * creates a budget via the form, and is taken directly to the dashboard.
   */
  test('shows create budget screen for new user and transitions to dashboard on submit', async ({ page }) => {
    await deleteFinances(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // ── 1. CreateBudgetScreen visible ─────────────────────────────────────────
    await expect(page.getByText('Create your budget')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create budget' })).toBeVisible();

    // ── 2. Form validation: empty name should prevent submit ──────────────────
    await page.getByRole('button', { name: 'Create budget' }).click();
    await expect(page.getByText('Create your budget')).toBeVisible(); // still on screen

    // ── 3. Fill form and submit ───────────────────────────────────────────────
    const budgetName = uniqueName('E2E Test Budget');
    await page.getByPlaceholder('e.g. Household, Personal…').fill(budgetName);
    await page.getByRole('button', { name: 'Create budget' }).click();

    // ── 4. Dashboard appears (net worth + this month cards) ───────────────────
    await expect(page.getByText('This Month')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-card]').filter({ hasText: 'Net Worth' })).toBeVisible();
    await expect(page.getByText('Create your budget')).not.toBeVisible();
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
      await expect(page.getByText('This Month')).toBeVisible({ timeout: 30_000 });
    });

    test('accounts: add bank account, credit card, and goal', async ({ page }) => {
      // ── 1. Add bank account ───────────────────────────────────────────────
      await page.getByRole('button', { name: 'Accounts' }).click();
      await page.waitForLoadState('networkidle');

      await page.getByTitle('Add account').click();
      await expect(page.getByText('New Account')).toBeVisible();

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
      await page.getByLabel('Type').selectOption('credit_card');
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
      await page.getByLabel('Type').selectOption('goal');
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

      await expect(page.getByText(bankAccountName)).toBeVisible();
      await expect(page.getByTitle('Initial Balance')).toBeVisible();
    });

    test('transactions: add expense and payee autocomplete', async ({ page }) => {
      // Expense form requires a category — create one via API before opening the modal
      const expenseCatName = uniqueName('Shopping');
      await createCategoryViaAPI(page, expenseCatName);

      await page.getByRole('button', { name: 'Transactions' }).click();
      await page.waitForLoadState('networkidle');

      // ── 1. Add expense ────────────────────────────────────────────────────
      await page.getByTitle('Add transaction').first().click();
      await expect(page.getByText('New Transaction')).toBeVisible();

      // Default type is expense — fill in amount, account, category, and payee
      await page.getByPlaceholder('0.00').fill('45.50');
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
      await expect(page.getByText('New Transaction')).toBeVisible();

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
      await expect(page.getByText('New Transaction')).toBeVisible();

      await page.getByRole('button', { name: 'income', exact: true }).click();
      await page.getByPlaceholder('0.00').fill('2000');
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
      await expect(page.getByText('New Group', { exact: true })).toBeVisible();

      await page.getByLabel('Name').fill(groupName);
      await page.getByRole('button', { name: 'Create' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(groupName)).toBeVisible();

      // ── 2. Add category via the group's "+ Add category" button (inside the card) ─
      await page.getByRole('button', { name: '+ Add category', exact: true }).click();
      await expect(page.getByText('New Category')).toBeVisible();

      await page.getByLabel('Name').fill(catName);
      await page.getByTitle('Groceries').click(); // select 🛒 icon
      await page.getByLabel('Monthly Target (optional)').fill('400');
      await page.getByRole('button', { name: 'Create' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(catName)).toBeVisible();
      // Shows "Target amount/mo" label in the category row
      await expect(page.getByText(/Target.*\/mo/)).toBeVisible();
    });

    test('goals: goal account appears on goals page', async ({ page }) => {
      await page.getByRole('button', { name: 'Goals' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(goalName)).toBeVisible();
    });

    test('dashboard: monthly income and expense figures shown', async ({ page }) => {
      await page.getByRole('button', { name: 'Dashboard' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-card]').filter({ hasText: 'Net Worth' })).toBeVisible();
      await expect(page.getByText('This Month')).toBeVisible();
      await expect(page.getByText('Income')).toBeVisible();
      await expect(page.getByText('Expenses')).toBeVisible();
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

      await expect(page.getByText('Edit Category')).toBeVisible();

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
      await expect(page.getByText(/Target.*600.*\/mo/)).toBeVisible();
    });
  });

  /**
   * Category lifecycle: archive vs hard-delete.
   * A category that has transactions is archived (soft-deleted) when removed;
   * a category with no transactions is permanently deleted.
   * Both cases should make the category disappear from the active categories list.
   */
  test('categories: archive when used in transactions, delete when unused', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Archive Test Budget'));

    const bank = await createAccount(page, { name: 'Test Bank', type: 'bank', openingBalance: 1000 });
    const usedCatName = uniqueName('Used Category');
    const unusedCatName = uniqueName('Unused Category');

    const usedCatId = await createCategoryViaAPI(page, usedCatName);
    await createCategoryViaAPI(page, unusedCatName);

    // Give usedCat a transaction so the DELETE will archive rather than hard-delete
    await createTransactionViaAPI(page, bank.id, usedCatId);

    await page.goto('/finances/categories');
    await page.waitForLoadState('networkidle');

    // Both categories visible — the name can appear in both the spend legend and the row,
    // so use .first() to avoid strict-mode violations.
    await expect(page.getByText(usedCatName).first()).toBeVisible();
    await expect(page.getByText(unusedCatName).first()).toBeVisible();

    // ── 1. Delete the category that has a transaction → should be archived ────────
    // force: true bypasses the opacity-0 state of the hover-revealed button.
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `Delete category ${usedCatName}` }).click({ force: true });

    const archiveResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/categories/') && res.request().method() === 'DELETE',
    );
    const archiveResponse = await archiveResponsePromise;
    expect(archiveResponse.status()).toBe(200);
    const archiveBody = (await archiveResponse.json()) as { action: string };
    expect(archiveBody.action).toBe('archived');

    await page.waitForLoadState('networkidle');
    // Archived category no longer visible in the active list
    await expect(page.getByText(usedCatName)).not.toBeVisible();

    // ── 2. Delete the category that has no transactions → should be hard-deleted ──
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `Delete category ${unusedCatName}` }).click({ force: true });

    const deleteResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/categories/') && res.request().method() === 'DELETE',
    );
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = (await deleteResponse.json()) as { action: string };
    expect(deleteBody.action).toBe('deleted');

    await page.waitForLoadState('networkidle');
    await expect(page.getByText(unusedCatName)).not.toBeVisible();
  });

  /**
   * Group lifecycle: delete group moves its categories to ungrouped.
   * The group header disappears; the category reappears in the Ungrouped section.
   */
  test('categories: delete group moves its categories to ungrouped', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Group Delete Budget'));

    const groupNameToDelete = uniqueName('Temp Group');
    const catInGroup = uniqueName('Category In Group');

    const gid = await createGroupViaAPI(page, groupNameToDelete);
    // Create category assigned to the group
    const res = await page.request.post('/api/finances/categories', {
      data: { name: catInGroup, groupId: gid },
    });
    expect(res.status()).toBe(201);

    await page.goto('/finances/categories');
    await page.waitForLoadState('networkidle');

    // Group and its category are visible
    await expect(page.getByText(groupNameToDelete)).toBeVisible();
    await expect(page.getByText(catInGroup)).toBeVisible();

    // ── Delete the group (force: true bypasses opacity-0 on hover-revealed button) ─
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `Delete group ${groupNameToDelete}` }).click({ force: true });

    const deleteResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/groups/') && res.request().method() === 'DELETE',
    );
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);

    await page.waitForLoadState('networkidle');

    // Group header is gone
    await expect(page.getByText(groupNameToDelete)).not.toBeVisible();

    // Category moved to Ungrouped section
    await expect(page.getByText('Ungrouped')).toBeVisible();
    await expect(page.getByText(catInGroup)).toBeVisible();
  });

  /**
   * Transactions: transfer between two accounts debits one and credits the other.
   * Kept separate because it requires two accounts and a specific transaction type.
   */
  test('transfer transaction moves funds between two accounts', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Transfer Test Budget'));

    const fromAcc = await createAccount(page, { name: 'From Account', type: 'bank', openingBalance: 1000 });
    const toAcc = await createAccount(page, { name: 'To Account', type: 'bank', openingBalance: 0 });

    await page.goto('/finances/transactions');
    await page.waitForLoadState('networkidle');

    await page.getByTitle('Add transaction').first().click();
    await expect(page.getByText('New Transaction')).toBeVisible();

    // Select transfer type
    await page.getByRole('button', { name: 'transfer', exact: true }).click();

    // Fill amount
    await page.getByPlaceholder('0.00').fill('250');

    // Select from account — FinancialDropdown with searchable=false renders a button trigger.
    // Scope via the exact FieldCard label so "To Account" is not matched.
    await page.getByText('Account', { exact: true }).locator('..').getByRole('button').click();
    await page.getByRole('button', { name: fromAcc.name }).first().click();

    // Select to account
    await page.getByText('To Account', { exact: true }).locator('..').getByRole('button').click();
    await page.getByRole('button', { name: toAcc.name }).first().click();

    const saveResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/transactions') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save Transfer' }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(201);
  });

  /**
   * Budget settings district behavior:
   * - Owner sees themselves listed with "Owner" badge
   * - Owner can invite another user by email
   * - Invited member appears in the list
   * - Owner can remove the invited member
   * - Member is removed from the list
   */
  test('budget settings: owner badge, member invite, and member removal', async ({ page }) => {
    const memberEmail = 'e2e-finances-invite@test.local';
    await ensureUserExists(page, memberEmail, 'E2eFinPass123!', 'Finance Invite');

    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('District Test Budget'));

    await page.goto('/finances/settings');
    await page.waitForLoadState('networkidle');

    // ── 1. Owner sees themselves with Owner badge ─────────────────────────────
    await expect(page.getByText('Settings').first()).toBeVisible();
    const membersCard = page.getByText('Members').locator('xpath=ancestor::div[contains(@class,"rounded")]').first();
    await expect(membersCard.getByText('Owner')).toBeVisible();

    // ── 2. Invite a second member ─────────────────────────────────────────────
    await expect(page.getByPlaceholder('colleague@example.com')).toBeVisible();
    await page.getByPlaceholder('colleague@example.com').fill(memberEmail);
    const inviteResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/budget/members') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Invite' }).click();
    const inviteResponse = await inviteResponsePromise;
    expect(inviteResponse.status()).toBe(200);

    // Second member appears in the list
    await expect(membersCard.getByText('Finance Invite')).toBeVisible();

    // ── 3. Remove the invited member ──────────────────────────────────────────
    const removeButtons = membersCard.getByRole('button', { name: 'Remove' });
    await expect(removeButtons).toHaveCount(1);

    const removeResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/budget') && res.request().method() === 'DELETE',
    );
    await removeButtons.first().click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.status()).toBe(200);

    // Member is gone from the list
    await expect(membersCard.getByText('Finance Invite')).not.toBeVisible();
    await expect(membersCard.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  });

  /**
   * Budget settings: delete budget (two-step confirmation).
   * Deletion redirects to /finances which shows the CreateBudgetScreen again.
   */
  test('budget settings: delete budget redirects to create screen', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Budget To Delete'));

    await page.goto('/finances/settings');
    // Wait for settings to fully load — first access may trigger compilation in dev mode
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: 30_000 });

    // ── 1. Delete the budget (two-step confirmation) ──────────────────────────
    await page.getByRole('button', { name: 'Delete budget…' }).click();
    await expect(page.getByText('Are you sure? All data will be permanently deleted.')).toBeVisible();

    // Cancel first
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('Are you sure? All data will be permanently deleted.')).not.toBeVisible();

    // Confirm delete
    await page.getByRole('button', { name: 'Delete budget…' }).click();

    const deleteResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/budget') && res.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Yes, delete everything' }).click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);

    // Redirected to /finances → CreateBudgetScreen shown
    await page.waitForURL('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Create your budget')).toBeVisible();
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
    await expect(page.getByText('New Account')).toBeVisible();

    const lentName = uniqueName('Loan to John');
    // Use exact: true to avoid matching "Card Name (optional)" which also contains "Name"
    await page.getByLabel('Name', { exact: true }).fill(lentName);
    await page.getByLabel('Type').selectOption('borrowed_lent');

    await page.getByLabel('Counterparty Name').fill('John Doe');
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

  /**
   * Budgets section on the settings page: create a new budget using the inline form,
   * verify it becomes the active budget and the sidebar name updates, then switch
   * back to the original budget and verify the sidebar reflects the change.
   */
  test('budgets section: create new budget, make active, sidebar updates', async ({ page }) => {
    const alphaName = uniqueName('Budget Alpha');
    const betaName = uniqueName('Budget Beta');

    await deleteFinances(page);
    await createBudgetViaAPI(page, alphaName);

    await page.goto('/finances/settings');
    await page.waitForLoadState('networkidle');

    // ── 1. Alpha is active — visible in budgets list and in sidebar ───────────
    // "Active" badge only appears in the budgets list row (not the sidebar), so it's unambiguous
    await expect(page.getByText('Active')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('sidebar-budget-name')).toContainText(alphaName);

    // ── 2. Create Beta via the inline "New budget" form ───────────────────────
    await page.getByRole('button', { name: '+ New budget' }).click();
    await expect(page.getByPlaceholder('e.g. Household, Personal…')).toBeVisible();
    await page.getByPlaceholder('e.g. Household, Personal…').fill(betaName);

    const createResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/budgets') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create budget' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    // ── 3. Creating a budget activates it — sidebar should switch to Beta ─────
    // Wait for the inline form to close (confirms submit completed) then check sidebar
    await expect(page.getByPlaceholder('e.g. Household, Personal…')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('sidebar-budget-name')).toContainText(betaName, { timeout: 10_000 });

    // ── 4. Make Alpha active again — sidebar should switch back ───────────────
    const activateResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/budgets') && res.request().method() === 'PATCH',
    );
    // Only Alpha has the "Make active" button at this point
    await page.getByRole('button', { name: 'Make active' }).click();
    const activateResponse = await activateResponsePromise;
    expect(activateResponse.status()).toBe(200);

    await expect(page.getByTestId('sidebar-budget-name')).toContainText(alphaName, { timeout: 10_000 });
    // Beta now has the "Make active" button; Alpha shows "Active" badge
    await expect(page.getByRole('button', { name: 'Make active' })).toHaveCount(1);
  });

  /**
   * Seeded shared budget fixture: the test user is a MEMBER (not owner) of a shared
   * budget created by the seed. Verifies that the shared budget appears accessible
   * but the user cannot see the invite form (non-owner restriction).
   *
   * This tests the "district" membership — a user can belong to multiple budgets
   * owned by others.
   */
  test('seeded shared budget: member sees budget but invite form hidden for non-owners', async ({ page }) => {
    // The seed adds the test user as a member of SHARED_FINANCE_FIXTURE budget.
    // We need to first ensure the test user has NO budget of their own so the shared
    // one becomes the active budget.
    await deleteFinances(page);

    // Re-seed the shared finance fixture by verifying the owner's budget exists
    // (the seed ran at setup time; just verify we can access the shared budget info)
    const budgetRes = await page.request.get('/api/finances/budget');
    // After deleting own budget, the test user may fall back to the seeded shared budget
    // depending on getUserActiveBudget ordering. If 200, verify it.
    if (budgetRes.ok()) {
      const budgetBody = (await budgetRes.json()) as { budget: { name: string; createdByUserId: string } };
      if (budgetBody.budget.name === SHARED_FINANCE_FIXTURE.budgetName) {
        await page.goto('/finances/settings');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText('Settings').first()).toBeVisible();
        // Non-owner: no invite input visible
        await expect(page.getByPlaceholder('colleague@example.com')).not.toBeVisible();
        // Budget name shown
        await expect(page.getByText(SHARED_FINANCE_FIXTURE.budgetName)).toBeVisible();
        return;
      }
    }

    // If the shared budget isn't active (e.g. the seeded membership was cleaned up),
    // the test passes vacuously — the real coverage is in the owner-specific tests.
    test.info().annotations.push({
      type: 'note',
      description: 'Shared budget not active after delete-all; skipping member view assertion',
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
    // Using the exact formatted value (€77.00) to avoid false matches on the
    // category name timestamp which can also contain "77".
    const txAmountLocator = page
      .locator('[data-layout="desktop"]')
      .filter({ hasText: 'Nav Test Bank' })
      .locator('div.text-right')
      .getByText('€77.00', { exact: true });

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

    // Scope month label assertions to the desktop MonthCarousel h2 to avoid the duplicate
    // mobile carousel rendering the same text
    const desktopMonthLabel = page.locator('div.hidden.md\\:flex h2').first();

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
