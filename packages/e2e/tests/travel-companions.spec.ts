import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { uniqueName, createTrip, modal, modalDesktop, modalTitle } from './travel-helpers';

function companionsCard(page: Page): Locator {
  return page
    .getByRole('heading', { name: 'Companions' })
    .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

function desktopRow(card: Locator, name: string): Locator {
  return card.locator('[data-layout="desktop"]').filter({ hasText: name }).first();
}

test.describe('Travel – Companions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel/companions');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Companion lifecycle: add via modal, edit name/email/phone, and remove via the
   * confirm dialog.
   */
  test('companion lifecycle: add, edit, and remove', async ({ page }) => {
    const tripName = uniqueName('E2E Companions Trip');
    const name = uniqueName('Jamie Doe');
    const updatedName = `${name} Updated`;

    await createTrip(page, tripName);
    const card = companionsCard(page);
    await expect(card).toBeVisible();

    // ── Add ────────────────────────────────────────────────────────────────────
    await card.getByRole('button', { name: '+ Add', exact: true }).click();
    let dialog = modal(page);
    await expect(modalDesktop(page).getByText('Add Companion', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('Full name').fill(name);
    await dialog.getByLabel('Email').fill('jamie@example.com');
    await dialog.getByLabel('Phone').fill('+1 555 0100');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const row = desktopRow(card, name);
    await expect(row).toBeVisible();
    await expect(row.getByText('jamie@example.com')).toBeVisible();

    // ── Edit ───────────────────────────────────────────────────────────────────
    await row.getByRole('button', { name: 'Edit companion' }).click({ force: true });
    dialog = modal(page);
    await expect(modalDesktop(page).getByText('Edit Companion', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('Full name').fill(updatedName);
    await dialog.getByLabel('Email').fill('jamie.updated@example.com');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const updatedRow = desktopRow(card, updatedName);
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.getByText('jamie.updated@example.com')).toBeVisible();

    // ── Remove ─────────────────────────────────────────────────────────────────
    await updatedRow.getByRole('button', { name: 'Remove companion' }).click({ force: true });
    const confirmDialog = modal(page);
    await expect(modalTitle(page).getByText('Remove Companion', { exact: true })).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(desktopRow(card, updatedName)).not.toBeVisible();
  });
});
