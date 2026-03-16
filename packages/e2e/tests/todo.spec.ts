import { test, expect } from '@playwright/test';
import { deleteFeatures } from './helpers';

test.describe('Todo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/todo');
    await page.waitForLoadState('networkidle');
    await deleteFeatures(page, ['todos']);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('page shows Todo heading and Add item section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Todo', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add item', level: 2 })).toBeVisible();
  });

  test('empty state shows All done message', async ({ page }) => {
    await expect(page.getByText('All done!')).toBeVisible();
  });

  test('adds a todo item', async ({ page }) => {
    await page.getByRole('textbox', { name: /title/i }).fill('Buy groceries');
    await page.getByRole('button', { name: /^add$/i }).click();

    await expect(page.getByText('Buy groceries')).toBeVisible({ timeout: 5_000 });
  });

  test('added item appears in the Open section', async ({ page }) => {
    await page.getByRole('textbox', { name: /title/i }).fill('Write tests');
    await page.getByRole('button', { name: /^add$/i }).click();

    await expect(page.getByRole('heading', { name: /^Open \(1\)$/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Write tests')).toBeVisible();
  });

  test('submits todo with Enter key', async ({ page }) => {
    await page.getByRole('textbox', { name: /title/i }).fill('Press enter todo');
    await page.getByRole('textbox', { name: /title/i }).press('Enter');

    await expect(page.getByText('Press enter todo')).toBeVisible({ timeout: 5_000 });
  });

  test('marks a todo as done', async ({ page }) => {
    // Add a todo first
    await page.getByRole('textbox', { name: /title/i }).fill('Finish this task');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText('Finish this task')).toBeVisible({ timeout: 5_000 });

    // Mark it done
    await page
      .getByRole('button', { name: /mark done/i })
      .first()
      .click();

    // Should move out of Open and into Done
    await expect(page.getByRole('heading', { name: /^Done \(1\)$/i })).toBeVisible({ timeout: 5_000 });
    // The item should now be struck through (in Done section)
    const doneSection = page.getByRole('heading', { name: /^Done/i }).locator('..').locator('..');
    await expect(doneSection.getByText('Finish this task')).toBeVisible();
  });

  test('done item no longer appears in Open section', async ({ page }) => {
    await page.getByRole('textbox', { name: /title/i }).fill('Complete me');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByRole('heading', { name: /^Open \(1\)/i })).toBeVisible({ timeout: 5_000 });

    await page
      .getByRole('button', { name: /mark done/i })
      .first()
      .click();

    // Open count should go back to 0 — "All done!" shows up
    await expect(page.getByText('All done!')).toBeVisible({ timeout: 5_000 });
  });

  test('multiple todos are listed in order', async ({ page }) => {
    await page.getByRole('textbox', { name: /title/i }).fill('First item');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText('First item')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('textbox', { name: /title/i }).fill('Second item');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText('Second item')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByRole('heading', { name: /^Open \(2\)/i })).toBeVisible();
  });

  test('home page has a Todo tile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: /todo/i })).toBeVisible();
  });
});
