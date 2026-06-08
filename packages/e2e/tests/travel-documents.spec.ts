import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { uniqueName, createTrip, getTripIdByName, modal, modalDesktop, modalTitle } from './travel-helpers';

function documentsCard(page: Page): Locator {
  return page
    .getByRole('heading', { name: 'Documents' })
    .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

function documentRow(card: Locator, title: string): Locator {
  return card.locator('div.flex.items-center.justify-between').filter({ hasText: title }).first();
}

test.describe('Travel – Documents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel/documents');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Document lifecycle: upload a file linked to a reservation, verify the link label,
   * download it, then delete it via the confirm dialog.
   */
  test('document lifecycle: upload linked to a reservation, download, and delete', async ({ page }) => {
    const tripName = uniqueName('E2E Documents Trip');
    const bookingTitle = uniqueName('Hotel Roma');
    const documentTitle = uniqueName('Booking Confirmation');

    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);
    const bookingRes = await page.request.post('/api/travel/bookings', {
      data: { tripId, title: bookingTitle, bookingType: 'accommodation' },
    });
    expect(bookingRes.ok()).toBeTruthy();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = documentsCard(page);
    await expect(card).toBeVisible();

    // ── Upload ─────────────────────────────────────────────────────────────────
    await card.getByRole('button', { name: 'Upload', exact: true }).click();
    const dialog = modal(page);
    await expect(modalDesktop(page).getByText('Upload Document', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('optional — defaults to filename').fill(documentTitle);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'travel-doc.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504E470D0A1A0A', 'hex'),
    });
    await dialog.getByLabel('Link to reservation').selectOption({ label: bookingTitle });

    const uploadResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/travel/documents/upload') && res.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    await expect(dialog).not.toBeVisible();

    const row = documentRow(card, documentTitle);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText(`Linked to: ${bookingTitle}`)).toBeVisible();

    // ── Download ───────────────────────────────────────────────────────────────
    const downloadLink = row.getByRole('link', { name: 'Download document' });
    await expect(downloadLink).toBeVisible();
    const href = await downloadLink.getAttribute('href');
    expect(href).toBeTruthy();
    const downloadRes = await page.request.get(href!);
    expect(downloadRes.ok()).toBeTruthy();

    // ── Delete ─────────────────────────────────────────────────────────────────
    await row.getByRole('button', { name: 'Delete document' }).click();
    const confirmDialog = modal(page);
    await expect(modalTitle(page).getByText('Delete Document', { exact: true })).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(documentRow(card, documentTitle)).not.toBeVisible();
  });
});
