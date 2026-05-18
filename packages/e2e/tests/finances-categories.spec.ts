import { test, expect } from '@playwright/test';
import {
  uniqueName,
  deleteFinances,
  createBudgetViaAPI,
  createAccount,
  createCategoryViaAPI,
  createGroupViaAPI,
  createTransactionViaAPI,
} from './finances-helpers';

test.describe('Finances – Categories', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finances/categories');
    await page.waitForLoadState('networkidle');
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

    // Each category name renders in both a mobile row (hidden) and a desktop row (visible);
    // scope to the desktop layout to target the visible element.
    const desktop = page.locator('[data-layout="desktop"]');
    await expect(desktop.getByText(usedCatName)).toBeVisible();
    await expect(desktop.getByText(unusedCatName)).toBeVisible();

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

    // Each category name renders in both a mobile row (hidden) and a desktop row (visible);
    // scope to the desktop layout to target the visible element.
    const desktop = page.locator('[data-layout="desktop"]');
    await expect(page.getByText(groupNameToDelete).first()).toBeVisible();
    await expect(desktop.getByText(catInGroup)).toBeVisible();

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
    await expect(page.getByText('Ungrouped').first()).toBeVisible();
    await expect(desktop.getByText(catInGroup)).toBeVisible();
  });
});
