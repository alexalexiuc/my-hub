import { test, expect } from '@playwright/test';
import { uniqueName, deleteFinances, createBudgetViaAPI, createAccount } from './finances-helpers';

test.describe('Finances – Deposits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finances/accounts');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Deposit journey: open (funding is a transfer) → list row + detail panel → log interest → close at maturity.
   */
  test('deposit journey: open, track interest, close at maturity', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Deposit Budget'));

    const sourceName = uniqueName('Dep Source');
    const payoutName = uniqueName('Dep Payout');
    const depositName = uniqueName('Maestro');
    const source = await createAccount(page, { name: sourceName, type: 'bank', openingBalance: 300_000 });
    const payout = await createAccount(page, { name: payoutName, type: 'bank' });
    const today = new Date().toISOString().slice(0, 10);

    // ── 1. Open the deposit (funding transfer from the source account) ───────
    const openRes = await page.request.post('/api/finances/accounts', {
      data: {
        name: depositName,
        type: 'deposit',
        currency: 'EUR',
        fundingSourceAccountId: source.id,
        details: {
          type: 'deposit',
          institution: 'MICB',
          productName: 'Maestro Online',
          instrument: 'bank_deposit',
          principal: 200_000,
          interestRate: 8,
          rateType: 'fixed',
          startDate: today,
          termMonths: 12,
          payout: 'monthly',
          payoutAccountId: payout.id,
          taxRate: 6,
        },
      },
    });
    expect(openRes.status()).toBe(201);
    const deposit = ((await openRes.json()) as { account: { id: number } }).account;

    // ── 2. Accounts list: Deposits group row shows rate and maturity ─────────
    await page.goto('/finances/accounts');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(depositName).first()).toBeVisible();
    await expect(page.getByText(/8% · matures/).first()).toBeVisible();

    // ── 3. Detail: principal balance and the summary panel ───────────────────
    await page.goto(`/finances/accounts/${deposit.id}`);
    await page.waitForLoadState('networkidle');
    const panel = page.getByTestId('deposit-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('MICB · Maestro Online')).toBeVisible();
    await expect(panel.getByText('7.52%')).toBeVisible(); // net yield: 8% after 6% tax
    await expect(panel.getByText(/15\.040/).first()).toBeVisible(); // expected net interest over the term

    // ── 4. Log the next scheduled interest payout ────────────────────────────
    await panel.getByRole('button', { name: 'Log interest' }).click();
    const recordRes = page.waitForResponse(
      res => res.url().includes(`/api/finances/accounts/${deposit.id}/deposit`) && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Record interest' }).click();
    expect((await recordRes).status()).toBe(200);
    await expect(panel.getByText(/1\.253/).first()).toBeVisible({ timeout: 10_000 });

    // ── 5. Close at maturity: principal returns, deposit shows as matured ────
    await panel.getByRole('button', { name: 'Close deposit' }).click();
    const closeRes = page.waitForResponse(
      res => res.url().includes(`/api/finances/accounts/${deposit.id}/deposit`) && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Close deposit' }).last().click();
    expect((await closeRes).status()).toBe(200);
    await expect(panel.getByText('Matured')).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByRole('button', { name: 'Log interest' })).toHaveCount(0);

    // The principal is back in the payout account (return account defaults to it).
    const accountsRes = await page.request.get('/api/finances/accounts');
    const { accounts } = (await accountsRes.json()) as { accounts: { id: number; balance: number }[] };
    expect(accounts.find(a => a.id === payout.id)!.balance).toBeCloseTo(201_253.33, 2);
  });

  /**
   * The Add account modal: pick Deposit, fill the deposit fields and the funding account, submit.
   */
  test('add account modal creates a funded deposit', async ({ page }) => {
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Deposit Form Budget'));

    const sourceName = uniqueName('Form Source');
    const depositName = uniqueName('Form Deposit');
    await createAccount(page, { name: sourceName, type: 'bank', openingBalance: 10_000 });
    await page.goto('/finances/accounts');
    await page.waitForLoadState('networkidle');

    await page.getByTitle('Add account').click();
    await page.getByLabel('Name', { exact: true }).fill(depositName);

    // Type dropdown → Deposit (the deposit fields appear)
    await page.getByLabel('Type').click();
    await page.getByRole('button', { name: '🔒 Deposit', exact: true }).click();

    await page.getByLabel('Institution').fill('Demo Bank');
    await page.getByLabel('Principal', { exact: true }).fill('5000');
    await page.getByLabel('Interest Rate %').fill('4');
    await page.getByLabel('Term (months)').fill('12');
    // Interest lands in / funded from: the source account (the only bank account in the budget)
    await page.getByLabel('Interest Lands In').click();
    await page.getByRole('button', { name: new RegExp(sourceName) }).click();
    await page.getByLabel('Funded From').click();
    await page.getByRole('button', { name: new RegExp(sourceName) }).click();

    const createRes = page.waitForResponse(
      res => res.url().endsWith('/api/finances/accounts') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create Account' }).click();
    expect((await createRes).status()).toBe(201);

    await expect(page.getByText(depositName).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/4% · matures/).first()).toBeVisible();
  });
});
