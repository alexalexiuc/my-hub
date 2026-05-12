import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Wipe all finances data for the authenticated test user. */
async function deleteFinances(page: Page) {
  await page.request.post('/api/user/delete-data', { data: { features: ['finances'] } });
}

/** Create a budget via the API. */
async function createBudgetViaAPI(page: Page, name: string, currency = 'EUR') {
  const res = await page.request.post('/api/finances/budgets', {
    data: { name, defaultCurrency: currency },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { budget: { id: number } };
  return body.budget.id;
}

/** Create an account via the API. Returns `{ id, name }`. */
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

/** Create a category via the API. Returns the category id. */
async function createCategoryViaAPI(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/finances/categories', { data: { name } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: number };
  return body.id;
}

/**
 * Import transactions via the API directly (bypasses the UI wizard).
 * Returns the batchId so the test can reference it for rollback.
 */
async function importViaAPI(page: Page, accountId: number, categoryId: number, filename: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await page.request.post('/api/finances/transactions/import', {
    data: {
      filename,
      rows: [
        { type: 'expense', date: today, amount: 20, accountId, categoryId, notes: 'API import row 1' },
        { type: 'expense', date: today, amount: 35, accountId, categoryId, notes: 'API import row 2' },
      ],
    },
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { batchId: string; importedCount: number };
  return body.batchId;
}

// ─── CSV helpers ───────────────────────────────────────────────────────────────

/**
 * Build a minimal CSV with two expense rows and one income row.
 * The payee column is named "Payee" so it is auto-detected by /payee/i.
 */
function buildCsv(payeeExpense: string, payeeIncome: string): string {
  const lines = [
    'Date,Amount,Payee,Notes',
    `2024-03-01,-45.50,${payeeExpense},Weekly groceries`,
    `2024-03-02,-12.00,${payeeExpense},Morning coffee`,
    `2024-03-03,2000.00,${payeeIncome},Monthly salary`,
  ];
  return lines.join('\n');
}

/**
 * Build a CSV that includes a Category column.
 */
function buildCsvWithCategory(payeeName: string, categoryName: string): string {
  const lines = [
    'Date,Amount,Payee,Category',
    `2024-07-01,-30.00,${payeeName},${categoryName}`,
    `2024-07-02,-15.00,${payeeName},${categoryName}`,
  ];
  return lines.join('\n');
}

/**
 * Upload a CSV file on the import wizard step 1. Uses `setInputFiles` with an
 * in-memory buffer so no temporary files are needed.
 */
async function uploadCsv(page: Page, csvContent: string, filename = 'test-import.csv') {
  await page.setInputFiles('input[type="file"][accept=".csv,text/csv"]', {
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent, 'utf-8'),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Finances – CSV Import', () => {
  test.describe.configure({ mode: 'serial' });

  const budgetName = uniqueName('Import E2E Budget');
  const accountName = uniqueName('Import Checking');
  const catName = uniqueName('Groceries Import');
  let accountId = 0;
  let categoryId = 0;

  test.beforeAll(async ({ browser }) => {
    // Set up shared state: budget + account + category
    const page = await browser.newPage();
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');

    await deleteFinances(page);
    await createBudgetViaAPI(page, budgetName);
    const account = await createAccount(page, { name: accountName, type: 'bank', openingBalance: 5000 });
    accountId = account.id;
    categoryId = await createCategoryViaAPI(page, catName);

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/finances/transactions/import');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Happy path: upload a CSV, map columns, create two new payees, assign a
   * category, proceed through all three wizard steps, and confirm the import.
   * After import the browser redirects to /finances/transactions with the
   * `imported` query param.
   */
  test('full import wizard: upload CSV, create payees, confirm import', async ({ page }) => {
    const payeeExpense = uniqueName('Supermarket Import');
    const payeeIncome = uniqueName('Employer Import');
    const csvContent = buildCsv(payeeExpense, payeeIncome);

    // ── Step 1: upload file ─────────────────────────────────────────────────
    await expect(page.getByText('Click to select a CSV file')).toBeVisible();
    await uploadCsv(page, csvContent);

    // File name and row count are shown after parsing
    await expect(page.getByText('test-import.csv')).toBeVisible();
    await expect(page.getByText('3 rows detected')).toBeVisible();

    // Select account
    await page.getByPlaceholder('Select account…').click();
    await page.getByRole('button', { name: accountName }).first().click();

    // Auto-detected columns — verify Date and Amount are pre-selected, and
    // Payee is auto-detected via /payee/i in autoDetectColumn.
    await expect(page.getByRole('combobox').first()).toHaveValue('Date');
    await expect(page.getByRole('combobox').nth(1)).toHaveValue('Amount');
    await expect(page.getByRole('combobox').nth(2)).toHaveValue('Payee');

    const previewBtn = page.getByRole('button', { name: /Preview/ });
    await expect(previewBtn).toBeEnabled();
    await previewBtn.click();

    // ── Step 2: preview / payee mapping ────────────────────────────────────
    await expect(page.getByText('Payee mapping')).toBeVisible({ timeout: 10_000 });

    // Two distinct payees detected
    await expect(page.getByText(payeeExpense)).toBeVisible();
    await expect(page.getByText(payeeIncome)).toBeVisible();

    // Both payees default to "Create" action (no existing payees to match)
    // At least one "new" stat visible in the payee mapping header
    await expect(page.getByText(/\d+ new/)).toBeVisible();

    // Assign a default category to the expense payee using the dropdown in its mapping row
    // The payee mapping panel has a "Default category…" placeholder per payee
    const expensePayeeRow = page
      .getByText(payeeExpense)
      .locator('xpath=ancestor::div[contains(@class,"flex-col")]')
      .last();
    await expensePayeeRow.getByPlaceholder('Default category…').click();
    await page.getByRole('button', { name: catName }).first().click();

    // Proceed to confirm step
    await page.getByRole('button', { name: 'Review →' }).click();

    // ── Step 3: confirm screen ──────────────────────────────────────────────
    await expect(page.getByText(/transactions? will be imported/)).toBeVisible({ timeout: 10_000 });
    // 3 rows in the CSV → 3 transactions
    await expect(page.getByText('3 transactions will be imported')).toBeVisible();

    // Click Import
    const importResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/transactions/import') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Import 3 transactions/ }).click();
    const importResponse = await importResponsePromise;
    expect(importResponse.status()).toBe(200);

    const importBody = (await importResponse.json()) as { batchId: string; importedCount: number };
    expect(importBody.importedCount).toBe(3);

    // Redirected to transactions page with imported query params
    await page.waitForURL(/\/finances\/transactions\?imported=.+&count=3/, { timeout: 15_000 });
  });

  /**
   * Payee auto-match: when the CSV payee name exactly matches an existing payee,
   * the mapping panel shows it as "matched" and pre-selects the "Match" action.
   */
  test('payee auto-match: existing payee is pre-matched in preview', async ({ page }) => {
    // Create a payee by running a small import via API first
    const existingPayeeName = uniqueName('KnownPayee Import');
    const firstImportRes = await page.request.post('/api/finances/transactions/import', {
      data: {
        filename: 'seed-payee.csv',
        rows: [
          {
            type: 'expense',
            date: '2024-02-01',
            amount: 10,
            accountId,
            categoryId,
            payeeName: existingPayeeName,
          },
        ],
      },
    });
    expect(firstImportRes.status()).toBe(200);

    // Reload so the component's useEffect re-fetches the payee list (it was
    // loaded on mount before this payee existed).
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Now upload a CSV that contains that same payee name
    const csvContent = ['Date,Amount,Payee', `2024-04-01,-25.00,${existingPayeeName}`].join('\n');

    await uploadCsv(page, csvContent);
    await expect(page.getByText('1 rows detected')).toBeVisible();

    // Select account
    await page.getByPlaceholder('Select account…').click();
    await page.getByRole('button', { name: accountName }).first().click();

    await page.getByRole('button', { name: /Preview/ }).click();

    // The payee should be shown as "matched" (auto-matched badge)
    await expect(page.getByText('● matched')).toBeVisible({ timeout: 10_000 });
    // Stat header shows 1 matched
    await expect(page.getByText('1 matched')).toBeVisible();
  });

  /**
   * Payee "Skip" action: setting a payee mapping to "Skip" causes those
   * transactions to be imported without a payee linked.
   * The preview stats update to reflect the skipped payee.
   */
  test('payee skip: setting action to Skip updates mapping stats', async ({ page }) => {
    const payeeName = uniqueName('SkipMe Import');
    const csvContent = ['Date,Amount,Payee', `2024-05-01,-8.00,${payeeName}`].join('\n');

    await uploadCsv(page, csvContent);
    await expect(page.getByText('1 rows detected')).toBeVisible();

    await page.getByPlaceholder('Select account…').click();
    await page.getByRole('button', { name: accountName }).first().click();

    await page.getByRole('button', { name: /Preview/ }).click();
    await expect(page.getByText('Payee mapping')).toBeVisible({ timeout: 10_000 });

    // Default is "Create"; switch to "Skip"
    await expect(page.getByText('1 new')).toBeVisible();
    const payeeRow = page.getByText(payeeName).locator('xpath=ancestor::div[contains(@class,"flex-col")]').last();
    await payeeRow.getByRole('button', { name: 'Skip' }).click();

    // Stat updates: 0 new, 1 skipped
    await expect(page.getByText('0 new')).toBeVisible();
    await expect(page.getByText('1 skipped')).toBeVisible();
  });

  /**
   * Category mapping panel: when the CSV has a Category column, the Category
   * mapping panel is shown. Unmatched CSV categories can be resolved by
   * selecting a system category from the dropdown. After mapping, the panel
   * shows 0 unresolved.
   */
  test('category mapping: CSV category column shows mapping panel', async ({ page }) => {
    const payeeName = uniqueName('CatMap Import');
    const csvCategoryName = uniqueName('CsvCat');
    const csvContent = buildCsvWithCategory(payeeName, csvCategoryName);

    await uploadCsv(page, csvContent);
    await expect(page.getByText('2 rows detected')).toBeVisible();

    await page.getByPlaceholder('Select account…').click();
    await page.getByRole('button', { name: accountName }).first().click();

    await page.getByRole('button', { name: /Preview/ }).click();

    // Category mapping panel should appear because CSV has a Category column
    await expect(page.getByText('Category mapping')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(csvCategoryName)).toBeVisible();

    // Should show 1 unresolved (the CSV category has no auto-match)
    await expect(page.getByText('1 unresolved')).toBeVisible();

    // Map the CSV category to the system category
    const catMappingPanel = page
      .getByText('Category mapping')
      .locator('xpath=ancestor::div[contains(@class,"rounded")]')
      .last();
    await catMappingPanel.getByPlaceholder('Select category…').click();
    await page.getByRole('button', { name: catName }).first().click();

    // After mapping, 0 unresolved
    await expect(catMappingPanel.getByText('0 unresolved')).toBeVisible();
  });

  /**
   * Ignore row: checking the "Ignore" checkbox on a transaction row in the
   * preview removes it from the active count on the confirm screen.
   */
  test('ignore row: ignored rows are excluded from import count', async ({ page }) => {
    const payeeName = uniqueName('IgnoreRow Import');
    const csvContent = ['Date,Amount,Payee', `2024-06-01,-10.00,${payeeName}`, `2024-06-02,-20.00,${payeeName}`].join(
      '\n',
    );

    await uploadCsv(page, csvContent);
    await expect(page.getByText('2 rows detected')).toBeVisible();

    await page.getByPlaceholder('Select account…').click();
    await page.getByRole('button', { name: accountName }).first().click();

    await page.getByRole('button', { name: /Preview/ }).click();
    await expect(page.getByRole('button', { name: 'Review →' })).toBeVisible({ timeout: 10_000 });

    // Ignore the first row — check the first "Ignore this row" checkbox
    const ignoreCheckboxes = page.getByTitle('Ignore this row');
    await ignoreCheckboxes.first().check();

    await page.getByRole('button', { name: 'Review →' }).click();

    // Confirm screen shows 1 transaction (not 2), and 1 row ignored
    await expect(page.getByText('1 transaction will be imported')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('1 row ignored')).toBeVisible();
  });

  /**
   * Rollback: after importing a batch via the API, navigate to the import page,
   * find the batch in the "Previous Imports" table, click Rollback, confirm the
   * modal, and verify:
   *   1. The batch status changes to "Rolled back".
   *   2. The DELETE API returns 200.
   *   3. The rolled-back transactions no longer exist (transaction count decreases).
   */
  test('rollback: rolled-back batch shows Rolled back status and transactions are deleted', async ({ page }) => {
    // Set up a batch via the API
    const batchFilename = `e2e-rollback-${Date.now()}.csv`;
    const batchId = await importViaAPI(page, accountId, categoryId, batchFilename);
    expect(batchId).toBeTruthy();

    // Count transactions before rollback
    const beforeRes = await page.request.get('/api/finances/transactions?limit=200');
    const beforeBody = (await beforeRes.json()) as { transactions: unknown[] };
    const countBefore = beforeBody.transactions.length;

    // Reload the import page so the new batch appears in the history table
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The batch filename appears in the table
    await expect(page.getByText(batchFilename)).toBeVisible({ timeout: 10_000 });
    // Status shows "Imported"
    const batchRow = page.getByText(batchFilename).locator('xpath=ancestor::tr').first();
    await expect(batchRow.getByText('Imported')).toBeVisible();

    // Click "Rollback" for that batch
    await batchRow.getByRole('button', { name: 'Rollback' }).click();

    // Confirmation modal appears
    await expect(page.getByText('Rollback Import?')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: batchFilename })).toBeVisible();

    // Confirm rollback
    const rollbackResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/finances/transactions/import/') && res.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Rollback' }).last().click();
    const rollbackResponse = await rollbackResponsePromise;
    expect(rollbackResponse.status()).toBe(200);

    const rollbackBody = (await rollbackResponse.json()) as { deletedCount: number };
    expect(rollbackBody.deletedCount).toBe(2); // importViaAPI creates 2 rows

    // Modal closes and row status updates to "Rolled back"
    await expect(page.getByText('Rollback Import?')).not.toBeVisible({ timeout: 10_000 });
    await expect(batchRow.getByText('Rolled back')).toBeVisible();

    // Rollback button no longer shown for the rolled-back batch
    await expect(batchRow.getByRole('button', { name: 'Rollback' })).not.toBeVisible();

    // Transactions were actually deleted
    const afterRes = await page.request.get('/api/finances/transactions?limit=200');
    const afterBody = (await afterRes.json()) as { transactions: unknown[] };
    const countAfter = afterBody.transactions.length;
    expect(countAfter).toBe(countBefore - 2);
  });

  /**
   * Rollback cancel: clicking "Cancel" in the rollback confirmation modal
   * closes the modal without performing the rollback.
   */
  test('rollback cancel: modal closes without deleting transactions', async ({ page }) => {
    const batchFilename = `e2e-rollback-cancel-${Date.now()}.csv`;
    await importViaAPI(page, accountId, categoryId, batchFilename);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(batchFilename)).toBeVisible({ timeout: 10_000 });
    const batchRow = page.getByText(batchFilename).locator('xpath=ancestor::tr').first();

    await batchRow.getByRole('button', { name: 'Rollback' }).click();
    await expect(page.getByText('Rollback Import?')).toBeVisible();

    // Cancel — modal should close without any DELETE request
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Rollback Import?')).not.toBeVisible({ timeout: 5_000 });

    // Batch still shows "Imported" status
    await expect(batchRow.getByText('Imported')).toBeVisible();
  });

  /**
   * Back navigation: the "← Transactions" back button on the upload step
   * navigates back to /finances/transactions.
   */
  test('back button navigates to transactions list', async ({ page }) => {
    await expect(page.getByRole('button', { name: '← Transactions' })).toBeVisible();
    await page.getByRole('button', { name: '← Transactions' }).click();
    await page.waitForURL('/finances/transactions');
  });
});
