import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TEST_USER } from '../config';
import { seedSharedTripFixture } from '../seeds/travel.seed';

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function createTrip(page: Page, tripName: string): Promise<void> {
  await page.getByPlaceholder('Trip name').first().fill(tripName);
  await page.getByPlaceholder('Destination').first().fill('Rome');
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByRole('button', { name: new RegExp(tripName) })).toBeVisible();
}

test.describe('Travel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel');
    await page.waitForLoadState('networkidle');
  });

  test('shows owner label and sharing controls for owned trips', async ({ page }) => {
    const tripName = uniqueName('E2E Owner Trip');

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) });
    await tripButton.click();

    await expect(tripButton).toContainText('Owner: You');
    await expect(page.getByPlaceholder('Share with user email')).toBeVisible();
    await expect(page.getByPlaceholder('Share with user email')).toBeEnabled();
  });

  test('supports full trip flow: create, edit, reservations, checklist, companions, and delete', async ({ page }) => {
    const tripName = uniqueName('E2E Full Trip');
    const editedTripName = `${tripName} Updated`;
    const bookingTitle = uniqueName('Flight Booking');
    const checklistTitle = uniqueName('Pack Charger');
    const companionName = uniqueName('Alex Companion');

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) });
    await tripButton.click();

    await page.getByRole('button', { name: 'Edit trip' }).first().click();
    await page.locator('input[placeholder="Trip name"]').nth(1).fill(editedTripName);
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByRole('button', { name: new RegExp(editedTripName) })).toBeVisible();

    await page.getByPlaceholder('Reservation title').fill(bookingTitle);
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    const bookingCard = page
      .locator('div.rounded-md.border.border-zinc-700.bg-zinc-900.px-3.py-2.text-sm')
      .filter({ has: page.locator('p.font-medium', { hasText: bookingTitle }) })
      .first();
    await expect(bookingCard).toBeVisible();

    await page.getByPlaceholder('Add checklist item').fill(checklistTitle);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const checklistRow = page
      .locator('div.w-full.rounded-md.border.px-3.py-2.text-left.text-sm')
      .filter({ has: page.getByRole('button', { name: checklistTitle }) })
      .first();
    const checklistButton = checklistRow.getByRole('button', { name: checklistTitle });
    await expect(checklistButton).toBeVisible();
    await checklistButton.click();
    await expect(checklistButton).toHaveClass(/line-through/);

    const companionsSection = page.getByRole('heading', { name: 'Companions' }).locator('xpath=ancestor::section[1]');
    await companionsSection.getByPlaceholder('Name').fill(companionName);
    await companionsSection.getByRole('button', { name: 'Add Companion' }).click();
    const companionCard = companionsSection
      .locator('div.rounded-md.border.border-zinc-700.bg-zinc-900.px-3.py-2.text-sm')
      .filter({ has: page.locator('p.font-medium', { hasText: companionName }) })
      .first();
    await expect(companionCard).toBeVisible();

    await bookingCard.getByRole('button', { name: 'Remove reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: bookingTitle })).not.toBeVisible();

    await checklistRow.getByRole('button', { name: 'Remove checklist item' }).click();
    await expect(page.getByRole('button', { name: checklistTitle })).not.toBeVisible();

    await companionCard.getByRole('button', { name: 'Remove companion' }).click();
    await expect(page.locator('p.font-medium', { hasText: companionName })).not.toBeVisible();

    await page.getByRole('button', { name: 'Remove trip' }).first().click();
    await expect(page.getByRole('button', { name: new RegExp(editedTripName) })).not.toBeVisible();
  });

  test('links uploaded document to reservation and shows booking attachment indicator', async ({ page }) => {
    const tripName = uniqueName('E2E Attachment Trip');
    const bookingTitle = uniqueName('Hotel Booking');
    const documentTitle = uniqueName('Boarding Doc');

    await createTrip(page, tripName);
    await page.getByRole('button', { name: new RegExp(tripName) }).click();

    await page.getByPlaceholder('Reservation title').fill(bookingTitle);
    await page.getByPlaceholder('Provider').fill('Hotel Test');
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: bookingTitle })).toBeVisible();

    await page.getByPlaceholder('Document title').fill(documentTitle);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'travel-doc.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504E470D0A1A0A', 'hex'),
    });

    const bookingLinkSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Link to reservation (optional)' }) })
      .first();
    await bookingLinkSelect.selectOption({ label: bookingTitle });

    await page.getByRole('button', { name: 'Upload Document' }).click();

    await expect(page.locator('p.font-medium', { hasText: documentTitle })).toBeVisible();
    await expect(page.getByText(`Linked to: ${bookingTitle}`)).toBeVisible();

    const attachmentButton = page.getByRole('button', { name: 'Show booking attachments' }).first();
    await expect(attachmentButton).toBeVisible();
    await attachmentButton.hover();
    const documentDownloadLink = page.getByRole('link', { name: documentTitle }).first();
    await expect(documentDownloadLink).toBeVisible();

    const href = await documentDownloadLink.getAttribute('href');
    expect(href).toBeTruthy();
    const downloadRes = await page.request.get(href!);
    expect(downloadRes.ok()).toBeTruthy();
  });

  test('shows a seeded shared trip in read-only mode for the viewer', async ({ page }) => {
    const fixture = await seedSharedTripFixture(TEST_USER.email);

    await page.reload();
    await page.waitForLoadState('networkidle');

    const tripButton = page.getByRole('button', { name: new RegExp(fixture.tripName) });
    await expect(tripButton).toBeVisible();
    await tripButton.click();

    await expect(tripButton).toContainText(`Owner: ${fixture.ownerName}`);
    await expect(
      page.getByText('Only the trip owner can manage sharing. You currently have view-only access.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Reservation' })).toBeDisabled();
    await expect(page.locator('p.font-medium', { hasText: fixture.bookingTitle })).toBeVisible();
  });
});
