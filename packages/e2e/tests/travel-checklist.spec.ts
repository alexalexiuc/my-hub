import { test, expect } from '@playwright/test';
import { uniqueName, createTrip, modal, modalDesktop, modalTitle } from './travel-helpers';

function checklistCard(page: import('@playwright/test').Page) {
  return page
    .getByRole('heading', { name: 'Checklist' })
    .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

function desktopRow(card: ReturnType<typeof checklistCard>, title: string) {
  return card.locator('[data-layout="desktop"]').filter({ hasText: title }).first();
}

test.describe('Travel – Checklist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel/checklist');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Checklist item lifecycle: add via modal, toggle done, edit (modal), cancel an
   * edit without saving, and delete via the confirm dialog.
   */
  test('checklist item lifecycle: add, toggle, edit, cancel, and delete', async ({ page }) => {
    const tripName = uniqueName('E2E Checklist Trip');
    const itemTitle = uniqueName('Pack Charger');
    const updatedTitle = `${itemTitle} Updated`;

    await createTrip(page, tripName);
    const card = checklistCard(page);
    await expect(card).toBeVisible();

    // ── Add ────────────────────────────────────────────────────────────────────
    await card.getByRole('button', { name: '+ Add', exact: true }).click();
    let dialog = modal(page);
    await expect(modalDesktop(page).getByText('Add Item', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('e.g. Pack passport').fill(itemTitle);
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const row = desktopRow(card, itemTitle);
    await expect(row).toBeVisible();
    const toggleButton = row.getByRole('button', { name: itemTitle, exact: true });

    // ── Toggle done ────────────────────────────────────────────────────────────
    await toggleButton.click();
    await expect(toggleButton).toHaveClass(/line-through/);

    // ── Edit ───────────────────────────────────────────────────────────────────
    await row.getByRole('button', { name: 'Edit item' }).click({ force: true });
    dialog = modal(page);
    await expect(modalDesktop(page).getByText('Edit Item', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('e.g. Pack passport').fill(updatedTitle);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const updatedRow = desktopRow(card, updatedTitle);
    await expect(updatedRow.getByRole('button', { name: updatedTitle, exact: true })).toBeVisible();
    await expect(card.locator('[data-layout="desktop"]').getByText(itemTitle, { exact: true })).not.toBeVisible();

    // ── Cancel edit preserves value ────────────────────────────────────────────
    await updatedRow.getByRole('button', { name: 'Edit item' }).click({ force: true });
    dialog = modal(page);
    await dialog.getByPlaceholder('e.g. Pack passport').fill(`${updatedTitle} Draft`);
    await modalDesktop(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(updatedRow.getByRole('button', { name: updatedTitle, exact: true })).toBeVisible();
    await expect(card.locator('[data-layout="desktop"]').getByText(`${updatedTitle} Draft`)).not.toBeVisible();

    // ── Delete ─────────────────────────────────────────────────────────────────
    await updatedRow.getByRole('button', { name: 'Delete item' }).click({ force: true });
    const confirmDialog = modal(page);
    await expect(modalTitle(page).getByText('Delete Item', { exact: true })).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(desktopRow(card, updatedTitle)).not.toBeVisible();
  });
});
