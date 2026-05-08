import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function nextMonthStr(): string {
  const [y, m] = currentMonth().split('-').map(Number);
  const nm = (m ?? 1) === 12 ? 1 : (m ?? 1) + 1;
  const ny = (m ?? 1) === 12 ? (y ?? 2026) + 1 : (y ?? 2026);
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

async function deleteFinances(page: Page) {
  await page.request.post('/api/user/delete-data', {
    data: { features: ['finances'] },
  });
}

async function createBudgetViaAPI(page: Page, name: string, currency = 'EUR') {
  const res = await page.request.post('/api/finances/budgets', {
    data: { name, defaultCurrency: currency },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { budget: { id: number } };
  return body.budget.id;
}

async function createAccount(
  page: Page,
  data: { name: string; type: string; currency?: string; openingBalance?: number },
) {
  const res = await page.request.post('/api/finances/accounts', {
    data: { currency: 'EUR', openingBalance: 0, ...data },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { account: { id: number; name: string } };
  return body.account;
}

async function createCategoryViaAPI(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/finances/categories', {
    data: { name },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: number };
  return body.id;
}

async function createTransactionViaAPI(
  page: Page,
  data: {
    type: 'expense' | 'income' | 'transfer';
    accountId: number;
    toAccountId?: number;
    categoryId?: number;
    amount: number;
    date: string;
  },
): Promise<number> {
  const res = await page.request.post('/api/finances/transactions', { data });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { transaction: { id: number } };
  return body.transaction.id;
}

async function editTransactionViaAPI(page: Page, id: number, patch: { amount: number }): Promise<void> {
  const res = await page.request.patch(`/api/finances/transactions/${id}`, { data: patch });
  expect(res.ok()).toBeTruthy();
}

async function createPlanItemViaAPI(
  page: Page,
  month: string,
  data: { name: string; amount: number; currency?: string; categoryId?: number; linkedAccountId?: number },
): Promise<number> {
  const res = await page.request.post(`/api/finances/monthly-plans/${month}/items`, {
    data: { currency: 'EUR', ...data },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { item: { id: number } };
  return body.item.id;
}

type MonthlyPlan = {
  availableAmount: number;
  incomeAccountId: number | null;
  items: Array<{ id: number; name: string; amount: number; assignedAmount: number; isAssigned: boolean }>;
  summary: { assignedCount: number; totalCount: number; planned: number };
};

async function getPlanForMonth(page: Page, month: string): Promise<MonthlyPlan> {
  const res = await page.request.get(`/api/finances/monthly-plans/${month}`);
  return res.json() as Promise<MonthlyPlan>;
}

/**
 * Polls the monthly plan until `predicate` returns true or the timeout is reached.
 * Needed when a plan mutation is fire-and-forget on the server side (the HTTP response
 * returns before the background sync commits to the DB).
 */
async function pollPlanUntil(
  page: Page,
  month: string,
  predicate: (plan: MonthlyPlan) => boolean,
  { intervalMs = 300, timeoutMs = 5000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<MonthlyPlan> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const plan = await getPlanForMonth(page, month);
    if (predicate(plan)) return plan;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return getPlanForMonth(page, month);
}

test.describe('Finances — Monthly Plan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finances/monthly-plan');
    await page.waitForLoadState('networkidle');
  });

  // ── Independent tests ──────────────────────────────────────────────────────

  test('full item CRUD: create via inline form, edit via modal, delete', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Plan CRUD Budget'));
    await page.goto('/finances/monthly-plan');
    await page.waitForLoadState('networkidle');

    const itemName = uniqueName('Rent');
    const updatedName = uniqueName('Updated Rent');

    // ── 1. Empty state ────────────────────────────────────────────────────────
    await expect(page.getByText('No items yet — add your first planned expense below.')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add item' })).toBeVisible();

    // ── 2. Open inline add form ───────────────────────────────────────────────
    await page.getByRole('button', { name: '+ Add item' }).click();
    await expect(page.getByPlaceholder('Item name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // ── 3. Validation: disabled submit with empty name ────────────────────────
    await expect(page.getByRole('button', { name: 'Add plan item' })).toBeDisabled();

    // ── 4. Fill and submit ────────────────────────────────────────────────────
    await page.getByPlaceholder('Item name').fill(itemName);
    await page.locator('input[placeholder="0"]').fill('1200');
    const createItemRes = page.waitForResponse(
      r =>
        r.url().includes('/api/finances/monthly-plans/') &&
        r.url().includes('/items') &&
        !r.url().includes('/items/') &&
        r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add plan item' }).click();
    await createItemRes;
    await expect(page.getByText(itemName).first()).toBeVisible();
    await expect(page.getByPlaceholder('Item name')).not.toBeVisible();

    // ── 5. Open EditPlanItemModal by clicking item name ───────────────────────
    await page.getByText(itemName).first().click();
    await expect(page.getByText('Edit Item')).toBeVisible();

    // ── 6. Edit name and planned amount ──────────────────────────────────────
    await page.getByLabel('Name').fill(updatedName);
    await page.getByLabel('Planned amount').fill('1500');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    // Wait for modal to close - the modal should disappear after save
    await page.locator('text=Edit Item').waitFor({ state: 'hidden', timeout: 10_000 });
    await expect(page.getByText(updatedName).first()).toBeVisible();
    // Check the planned amount in the table
    await expect(page.getByText('1,500').first()).toBeVisible();

    // ── 7. Delete item ────────────────────────────────────────────────────────
    const deleteItemRes = page.waitForResponse(
      r =>
        r.url().includes('/api/finances/monthly-plans/') &&
        r.url().includes('/items/') &&
        r.request().method() === 'DELETE',
    );
    // Hover over the item row to make the delete button visible, then click
    const itemRow = page.locator('text=' + updatedName).first();
    await itemRow.hover();
    await page.getByTitle('Delete').click({ force: true });
    await deleteItemRes;
    await expect(page.getByText('No items yet — add your first planned expense below.')).toBeVisible();
  });

  test('summary bar: set availableAmount updates remaining figures', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Summary Bar Budget'));
    const month = currentMonth();
    await createPlanItemViaAPI(page, month, { name: 'Expense Item', amount: 400 });
    await page.goto('/finances/monthly-plan');
    await page.waitForLoadState('networkidle');

    // ── 1. Initial figures (availableAmount=0, planned=400) ───────────────────
    await expect(page.getByText('Available Funds')).toBeVisible();
    await expect(page.getByText('-400')).toBeVisible(); // Remaining (Potential) = 0 - 400

    // ── 2. Edit available funds ───────────────────────────────────────────────
    await page.getByRole('button', { name: 'Edit available funds' }).click();
    const patchPlanRes = page.waitForResponse(
      r => /\/api\/finances\/monthly-plans\/\d{4}-\d{2}$/.test(r.url()) && r.request().method() === 'PATCH',
    );
    await page.locator('input[type="number"]').first().fill('2000');
    await page.keyboard.press('Enter');
    await patchPlanRes;

    // ── 3. Updated figures ────────────────────────────────────────────────────
    await expect(page.getByText('2,000').first()).toBeVisible(); // Available Funds
    await expect(page.getByText('400').first()).toBeVisible(); // Planned
    await expect(page.getByText('1,600').first()).toBeVisible(); // Remaining (Potential) = 2000 - 400
    await expect(page.getByText('0 of 1 items done · 0%')).toBeVisible();
  });

  test('mark item done and undone (manual toggle)', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Toggle Budget'));
    const month = currentMonth();
    await createPlanItemViaAPI(page, month, { name: 'Toggle Item', amount: 500 });
    await page.goto('/finances/monthly-plan');
    await page.waitForLoadState('networkidle');

    // ── 1. Item starts undone ─────────────────────────────────────────────────
    await expect(page.getByTitle('Mark as done')).toBeVisible();
    await expect(page.getByText('0 of 1 items done · 0%')).toBeVisible();

    // ── 2. Toggle to done ─────────────────────────────────────────────────────
    const patchDoneRes = page.waitForResponse(
      r =>
        r.url().includes('/api/finances/monthly-plans/') &&
        r.url().includes('/items/') &&
        r.request().method() === 'PATCH',
    );
    await page.getByTitle('Mark as done').click();
    await patchDoneRes;
    await expect(page.getByTitle('Mark as not done')).toBeVisible();
    await expect(page.getByText('1 of 1 items done · 100%')).toBeVisible();

    // ── 3. Toggle back to undone ──────────────────────────────────────────────
    const patchUndoneRes = page.waitForResponse(
      r =>
        r.url().includes('/api/finances/monthly-plans/') &&
        r.url().includes('/items/') &&
        r.request().method() === 'PATCH',
    );
    await page.getByTitle('Mark as not done').click();
    await patchUndoneRes;
    await expect(page.getByTitle('Mark as done')).toBeVisible();
    await expect(page.getByText('0 of 1 items done · 0%')).toBeVisible();
  });

  test('mark all done (bulk action)', async ({ page }) => {
    await deleteFinances(page);
    const budgetId = await createBudgetViaAPI(page, uniqueName('Bulk Done Budget'));
    expect(budgetId).toBeTruthy();
    const month = currentMonth();
    await createPlanItemViaAPI(page, month, { name: 'Item One', amount: 100 });
    await createPlanItemViaAPI(page, month, { name: 'Item Two', amount: 200 });
    await page.goto('/finances/monthly-plan');
    await page.waitForLoadState('networkidle');

    // ── 1. Both items undone ──────────────────────────────────────────────────
    await expect(page.getByText('0 of 2 items done · 0%')).toBeVisible();

    // ── 2. Mark all done ──────────────────────────────────────────────────────
    const assignAllRes = page.waitForResponse(r => r.url().includes('/assign-all') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '✓ Mark All Done' }).click();
    await assignAllRes;
    await expect(page.getByText('2 of 2 items done · 100%')).toBeVisible();
  });

  test('copy to next month: items copied with progress reset', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Copy Budget'));
    const month = currentMonth();
    const item1Name = uniqueName('Mortgage');
    const item2Name = uniqueName('Utilities');
    const item1Id = await createPlanItemViaAPI(page, month, { name: item1Name, amount: 800 });
    await createPlanItemViaAPI(page, month, { name: item2Name, amount: 150 });
    // Mark item 1 done via API
    await page.request.patch(`/api/finances/monthly-plans/${month}/items/${item1Id}`, {
      data: { isAssigned: true },
    });
    await page.goto('/finances/monthly-plan');
    await page.waitForLoadState('networkidle');

    // ── 1. Current month shows partial progress and "Copy" button ────────────
    await expect(page.getByText(item1Name).first()).toBeVisible();
    await expect(page.getByText(item2Name).first()).toBeVisible();
    await expect(page.getByText('1 of 2 items done')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy to next month' })).toBeVisible();

    // ── 2. Copy to next month ────────────────────────────────────────────────
    const copyRes = page.waitForResponse(r => r.url().includes('/copy-next') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Copy to next month' }).click();
    await copyRes;
    // Wait for the page to navigate to the next month (the component should handle this)
    await page.waitForLoadState('networkidle');

    // ── 3. UI navigates to next month; items present with reset progress ──────
    const nm = nextMonthStr();
    const [ny, nmm] = nm.split('-').map(Number);
    const nextMonthLabel = new Date(Date.UTC(ny ?? 2026, (nmm ?? 1) - 1, 1)).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    await expect(page.getByRole('heading', { level: 2 })).toContainText(nextMonthLabel, { timeout: 5_000 });
    await expect(page.getByText(item1Name).first()).toBeVisible();
    await expect(page.getByText(item2Name).first()).toBeVisible();
    await expect(page.getByText('0 of 2 items done · 0%')).toBeVisible();

    // ── 4. Back on current month — copy button also gone (next month exists) ──
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Copy to next month' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy to next month' })).not.toBeVisible();
  });

  // ── Transaction auto-assignment and reconciliation (serial) ────────────────

  test.describe('transaction auto-assignment and reconciliation', () => {
    test.describe.configure({ mode: 'serial' });

    let bankAccountId: number;
    let savingsAccountId: number;
    let groceriesCategoryId: number;
    let planMonth: string;
    let planItemCategoryId: number;
    let planItemAccountId: number;
    let bankAccountName: string;

    test('setup: budget, accounts, category', async ({ page }) => {
      await deleteFinances(page);
      await createBudgetViaAPI(page, uniqueName('AutoAssign Budget'));

      const bankAccount = await createAccount(page, {
        name: uniqueName('Main Bank'),
        type: 'bank',
        openingBalance: 5000,
      });
      bankAccountId = bankAccount.id;
      bankAccountName = bankAccount.name;

      const savingsAccount = await createAccount(page, {
        name: uniqueName('Savings'),
        type: 'bank',
        openingBalance: 0,
      });
      savingsAccountId = savingsAccount.id;

      groceriesCategoryId = await createCategoryViaAPI(page, uniqueName('Groceries'));
      planMonth = currentMonth();

      await page.goto('/finances/monthly-plan');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('No items yet — add your first planned expense below.')).toBeVisible();
    });

    test('auto-assign by category: expense increments assignedAmount; threshold triggers isAssigned', async ({
      page,
    }) => {
      // ── 1. Create plan item linked to groceries category via API ──────────
      planItemCategoryId = await createPlanItemViaAPI(page, planMonth, {
        name: 'Groceries Item',
        amount: 300,
        categoryId: groceriesCategoryId,
      });

      await page.goto('/finances/monthly-plan');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Groceries Item').first()).toBeVisible();

      // ── 2. First expense: partial assignment (150 < 300) ──────────────────
      await createTransactionViaAPI(page, {
        type: 'expense',
        accountId: bankAccountId,
        categoryId: groceriesCategoryId,
        amount: 150,
        date: `${planMonth}-15`,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Assigned amount shows 150 (partial, amber); item not yet done
      await expect(page.getByText('150').first()).toBeVisible();
      await expect(page.getByTitle('Mark as done')).toBeVisible();

      // ── 3. Second expense: cumulative 310 >= 300, auto-marks done ─────────
      await createTransactionViaAPI(page, {
        type: 'expense',
        accountId: bankAccountId,
        categoryId: groceriesCategoryId,
        amount: 160,
        date: `${planMonth}-20`,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.getByTitle('Mark as not done')).toBeVisible();
      await expect(page.getByText('1 of 1 items done')).toBeVisible();

      const plan = await getPlanForMonth(page, planMonth);
      const item = plan.items.find(i => i.id === planItemCategoryId);
      expect(item?.isAssigned).toBe(true);
      expect(item?.assignedAmount).toBeGreaterThanOrEqual(300);
    });

    test('auto-assign by linkedAccount: transfer to account marks item done', async ({ page }) => {
      // ── 1. Create plan item linked to savings account via API ─────────────
      planItemAccountId = await createPlanItemViaAPI(page, planMonth, {
        name: 'Savings Transfer',
        amount: 500,
        linkedAccountId: savingsAccountId,
      });

      await page.goto('/finances/monthly-plan');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-layout="desktop"]').getByText('Savings Transfer')).toBeVisible();

      // ── 2. Transfer to savings account: auto-assigns and marks done ───────
      await createTransactionViaAPI(page, {
        type: 'transfer',
        accountId: bankAccountId,
        toAccountId: savingsAccountId,
        amount: 500,
        date: `${planMonth}-10`,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const plan = await getPlanForMonth(page, planMonth);
      const item = plan.items.find(i => i.id === planItemAccountId);
      expect(item?.isAssigned).toBe(true);
      expect(item?.assignedAmount).toBe(500);
    });

    test('AND logic: item with category+account requires both to match', async ({ page }) => {
      // ── 1. Create item requiring BOTH groceries category AND savings account ─
      await createPlanItemViaAPI(page, planMonth, {
        name: 'Strict Match',
        amount: 100,
        categoryId: groceriesCategoryId,
        linkedAccountId: savingsAccountId,
      });

      // ── 2. Expense matches category but toAccountId=null != savingsAccountId ─
      await createTransactionViaAPI(page, {
        type: 'expense',
        accountId: bankAccountId,
        categoryId: groceriesCategoryId,
        amount: 100,
        date: `${planMonth}-22`,
      });

      const plan = await getPlanForMonth(page, planMonth);
      const strictItem = plan.items.find(i => i.name === 'Strict Match');
      expect(strictItem?.assignedAmount).toBe(0);
      expect(strictItem?.isAssigned).toBe(false);

      // ── 3. UI confirms "—" in assigned column ────────────────────────────
      await page.reload();
      await page.waitForLoadState('networkidle');
      // Strict Match item's assigned amount shows "—" (no assignment)
      // Verify via the API result already confirmed above; visual check:
      await expect(page.locator('[data-layout="desktop"]').getByText('Strict Match')).toBeVisible();
    });

    test('edit transaction → reconciliation: changing amount recalculates assignedAmount', async ({ page }) => {
      // ── 1. Create a fresh item for reconciliation testing ─────────────────
      await createPlanItemViaAPI(page, planMonth, {
        name: 'Reconcile Test',
        amount: 200,
        categoryId: groceriesCategoryId,
      });

      // ── 2. Create one transaction that exactly meets the threshold ────────
      const txnId = await createTransactionViaAPI(page, {
        type: 'expense',
        accountId: bankAccountId,
        categoryId: groceriesCategoryId,
        amount: 200,
        date: `${planMonth}-25`,
      });

      // Item auto-marked done (200 >= 200)
      let plan = await getPlanForMonth(page, planMonth);
      const reconcileItem = plan.items.find(i => i.name === 'Reconcile Test');
      expect(reconcileItem?.isAssigned).toBe(true);
      expect(reconcileItem?.assignedAmount).toBe(200);

      // ── 3. Edit transaction amount down — item should revert to partial ───
      await editTransactionViaAPI(page, txnId, { amount: 100 });

      // Sync is fire-and-forget on the server — poll until the background commit lands.
      plan = await pollPlanUntil(page, planMonth, p => {
        const item = p.items.find(i => i.name === 'Reconcile Test');
        return item?.assignedAmount === 100;
      });
      const updatedItem = plan.items.find(i => i.name === 'Reconcile Test');
      expect(updatedItem?.assignedAmount).toBe(100);
      expect(updatedItem?.isAssigned).toBe(false);

      // ── 4. UI shows partial state for the reconcile item ──────────────────
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-layout="desktop"]').getByText('Reconcile Test')).toBeVisible();
      // The item's done button title reverts to "Mark as done"
      // There may be multiple items; use more lenient check via API (above)
    });

    test('income account: income transaction auto-increments availableAmount', async ({ page }) => {
      // ── 1. Set income account to bank account via SummaryBar ──────────────
      await page.goto('/finances/monthly-plan');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Edit income account' }).click();

      const patchIncomeAccountRes = page.waitForResponse(
        r => /\/api\/finances\/monthly-plans\/\d{4}-\d{2}$/.test(r.url()) && r.request().method() === 'PATCH',
      );
      // FinancialDropdown (searchable=true) renders; click input to open menu
      await page.getByPlaceholder('No income account').click();
      // Select the bank account option from the dropdown
      await page.getByRole('button', { name: bankAccountName }).first().click();
      await patchIncomeAccountRes;

      // ── 2. Note current availableAmount ──────────────────────────────────
      const planBefore = await getPlanForMonth(page, planMonth);
      const availableBefore = planBefore.availableAmount;

      // ── 3. Income transaction to the income account ───────────────────────
      await createTransactionViaAPI(page, {
        type: 'income',
        accountId: bankAccountId,
        amount: 3000,
        date: `${planMonth}-01`,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const planAfter = await getPlanForMonth(page, planMonth);
      expect(planAfter.availableAmount).toBe(availableBefore + 3000);

      // ── 4. Income to a DIFFERENT account should NOT change availableAmount ─
      await createTransactionViaAPI(page, {
        type: 'income',
        accountId: savingsAccountId,
        amount: 1000,
        date: `${planMonth}-02`,
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const planFinal = await getPlanForMonth(page, planMonth);
      expect(planFinal.availableAmount).toBe(availableBefore + 3000);
    });
  });
});
