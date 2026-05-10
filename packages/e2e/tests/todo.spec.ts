import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';

async function addTodo(page: Parameters<typeof deleteFeatures>[0], title: string) {
  await page.getByRole('button', { name: /^add$/i }).click();
  await page.getByPlaceholder('New task...').fill(title);
  await page.getByPlaceholder('New task...').press('Enter');
}

test.describe('Todo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/todo');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['todos']);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  /**
   * Full todo workflow: empty state → add items → mark done → all caught up.
   * Note: addTodo() submits via Enter key, so keyboard submission is exercised on every add.
   */
  test('full todo workflow: empty state, add items, mark done', async ({ page }) => {
    // ── 1. Empty state ────────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Todo', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /^add$/i })).toBeVisible();
    await expect(page.getByText('All caught up!')).toBeVisible();

    // ── 2. Add two items ──────────────────────────────────────────────────────
    await addTodo(page, 'Write tests');
    await expect(page.getByText('Write tests')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /^Open \(1\)$/i })).toBeVisible();

    await addTodo(page, 'Buy groceries');
    await expect(page.getByText('Buy groceries')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /^Open \(2\)$/i })).toBeVisible();

    // ── 3. Mark first item done ───────────────────────────────────────────────
    await page
      .getByRole('button', { name: /mark done/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: /^Done \(1\)$/i })).toBeVisible({ timeout: 5_000 });
    const doneSection = page.getByRole('heading', { name: /^Done/i }).locator('..').locator('..');
    await expect(doneSection.getByText('Write tests')).toBeVisible();

    // ── 4. Mark remaining item done → back to empty state ────────────────────
    await page
      .getByRole('button', { name: /mark done/i })
      .first()
      .click();
    await expect(page.getByText('All caught up!')).toBeVisible({ timeout: 5_000 });
  });
});
