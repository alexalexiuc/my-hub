import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { uniqueName, deleteFinances, createBudgetViaAPI } from './finances-helpers';

// Fake tickers so no real EOD price ever resolves — assertions cover only
// price-independent math (units, cost, invested).
const SYM_A = 'E2EAAA';
const SYM_B = 'E2EBBB';

const modal = (page: Page) => page.locator('.modal-shell');

async function fillNthByPlaceholder(page: Page, placeholder: string, index: number, value: string) {
  // exact: true avoids cross-matches between overlapping placeholders, e.g. 'SPYL' is a
  // substring of 'SPYL.DE', and '0' is a substring of 'SPDR S&P 500 UCITS ETF'.
  await modal(page).getByPlaceholder(placeholder, { exact: true }).nth(index).fill(value);
}

test.describe.configure({ mode: 'serial' });

test.describe('Finances – Portfolio', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await deleteFinances(page);
    await createBudgetViaAPI(page, uniqueName('Portfolio Budget'));
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/finances/portfolio');
    await page.waitForLoadState('networkidle');
  });

  test('empty state lets the user set up a portfolio with two positions', async ({ page }) => {
    await expect(page.getByText('Track your ETF portfolio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Set up portfolio' }).click();

    await expect(modal(page).locator('[data-layout="desktop"]').getByText('Set up Portfolio')).toBeVisible();

    // One row exists by default — add a second.
    await modal(page).getByRole('button', { name: '+ Add position' }).click();

    await fillNthByPlaceholder(page, 'SPYL', 0, SYM_A);
    await fillNthByPlaceholder(page, 'SPYL.DE', 0, `${SYM_A}.DE`);
    await fillNthByPlaceholder(page, '0', 0, '60');
    await fillNthByPlaceholder(page, 'SPYL', 1, SYM_B);
    await fillNthByPlaceholder(page, 'SPYL.DE', 1, `${SYM_B}.DE`);
    await fillNthByPlaceholder(page, '0', 1, '40');

    await modal(page).getByRole('button', { name: 'Save' }).click();

    // Populated state — positions table shows both tickers.
    await expect(page.getByText('Positions', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(SYM_A)).toBeVisible();
    await expect(page.getByText(SYM_B)).toBeVisible();
  });

  test('records a supply with auto-computed total', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Supply' }).click();
    await expect(modal(page).locator('[data-layout="desktop"]').getByText('Add Supply')).toBeVisible();

    // Date defaults to today; fill the two pre-populated lines.
    const units = modal(page).getByPlaceholder('0', { exact: true });
    const prices = modal(page).getByPlaceholder('0.00');

    await units.nth(0).fill('10');
    await prices.nth(0).fill('50');
    await units.nth(1).fill('5');
    await prices.nth(1).fill('40');

    // Total field auto-syncs to Σ(units×price+fee) = 10×50 + 5×40 = 700 (fees default 0).
    const totalInput = modal(page).getByPlaceholder('0.00').last();
    await expect(totalInput).toHaveValue('700');

    await modal(page).getByRole('button', { name: 'Save' }).click();

    // Summary "Invested" card reflects the contributed total.
    await expect(page.getByText('Invested')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('700,00 €')).toBeVisible();
  });

  test('settings modal rejects allocations that do not sum to 100', async ({ page }) => {
    // exact: true — the sidebar nav also has a "⚙ Settings" link that substring-matches.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(modal(page).locator('[data-layout="desktop"]').getByText('Portfolio Settings')).toBeVisible();

    // Change the first target so the sum drifts away from 100. exact: true — '0' is a
    // substring of the name field's placeholder ('SPDR S&P 500 UCITS ETF'), same collision
    // documented on fillNthByPlaceholder above.
    await modal(page).getByPlaceholder('0', { exact: true }).first().fill('10');
    await modal(page).getByRole('button', { name: 'Save' }).click();

    await expect(modal(page).getByText(/must sum to 100/i)).toBeVisible();
  });
});
