import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { uniqueName, toDateTimeLocal, createTrip, modal, modalTitle } from './travel-helpers';

/**
 * Desktop variant of a booking row (rows render both mobile/desktop layouts
 * simultaneously, including the expanded-details panel — scope to this to avoid
 * strict-mode collisions when asserting on expanded content).
 */
function bookingRowDesktop(page: Page, title: string): Locator {
  return page
    .locator('[data-testid="booking-row"]')
    .filter({ has: page.locator('[data-layout="desktop"]') })
    .filter({ hasText: title })
    .locator('[data-layout="desktop"]')
    .first();
}

/**
 * The row's clickable toggle area. The `role="button" aria-expanded` element
 * also contains the Edit/Delete icon buttons, so this single locator covers
 * expand/collapse assertions and action-button lookups.
 */
function bookingRow(page: Page, title: string): Locator {
  return bookingRowDesktop(page, title).locator('[role="button"]').first();
}

function reservationsCard(page: Page): Locator {
  return page
    .getByRole('heading', { name: 'Reservations' })
    .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

test.describe('Travel – Bookings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel/bookings');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Full reservation lifecycle on a single trip: add a generic reservation, a flight with
   * full details (using the booking-type pill grid), an accommodation, and a transport
   * booking; expand/collapse rows; edit the flight; and delete a reservation.
   */
  test('reservation lifecycle: add every type, expand, edit, and delete', async ({ page }) => {
    const tripName = uniqueName('E2E Bookings Trip');
    const genericTitle = uniqueName('Generic Booking');
    const flightTitle = uniqueName('London to Paris Flight');
    const hotelTitle = uniqueName('Hotel Roma');
    const trainTitle = uniqueName('Paris Express');
    const now = new Date();
    const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const endAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    await createTrip(page, tripName);
    const card = reservationsCard(page);
    await expect(card).toBeVisible();

    // ── 1. Generic reservation: add, expand, collapse ─────────────────────────
    await card.getByRole('button', { name: '+ Add', exact: true }).click();
    let dialog = modal(page);
    await expect(modalTitle(page).getByText('Add Reservation', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('e.g. Tokyo — London BA0007').fill(genericTitle);
    await dialog.getByPlaceholder('e.g. British Airways').fill('Test Provider');
    await dialog.getByRole('button', { name: 'Add Reservation', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const genericRow = bookingRow(page, genericTitle);
    await expect(genericRow).toBeVisible();
    await genericRow.click();
    await expect(genericRow).toHaveAttribute('aria-expanded', 'true');
    await genericRow.click();
    await expect(genericRow).toHaveAttribute('aria-expanded', 'false');

    // ── 2. Flight booking with full details (booking-type pill grid) ──────────
    await card.getByRole('button', { name: '+ Add', exact: true }).click();
    dialog = modal(page);
    await dialog.getByPlaceholder('e.g. Tokyo — London BA0007').fill(flightTitle);
    await dialog.getByRole('button', { name: 'Flight', exact: true }).click();
    await dialog.getByPlaceholder('e.g. BA2490').fill('BA2490');
    await dialog.getByPlaceholder('e.g. 14A').fill('14A');
    await dialog.getByPlaceholder('LHR').fill('LHR');
    await dialog.getByPlaceholder('CDG').fill('CDG');
    await dialog.getByLabel('Terminal').fill('3');
    await dialog.getByLabel('Gate').fill('B25');
    await dialog.getByRole('button', { name: 'Add Reservation', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const flightRowDesktop = bookingRowDesktop(page, flightTitle);
    const flightRow = bookingRow(page, flightTitle);
    await flightRow.click();
    await expect(flightRowDesktop.getByText(/BA2490/i)).toBeVisible();
    await expect(flightRowDesktop.getByText('LHR→CDG')).toBeVisible();
    await expect(flightRowDesktop.getByText(/Seat 14A/i)).toBeVisible();
    await expect(flightRowDesktop.getByText(/Gate B25/i)).toBeVisible();

    // ── 3. Edit flight booking ─────────────────────────────────────────────────
    await flightRow.getByRole('button', { name: 'Edit reservation' }).click({ force: true });
    dialog = modal(page);
    await expect(modalTitle(page).getByText('Edit Reservation', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('e.g. BA2490').fill('BA2491');
    await dialog.getByPlaceholder('e.g. 14A').fill('15B');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await expect(flightRowDesktop.getByText(/BA2491/i)).toBeVisible();
    await expect(flightRowDesktop.getByText(/Seat 15B/i)).toBeVisible();

    // ── 4. Accommodation with start/end dates ─────────────────────────────────
    await card.getByRole('button', { name: '+ Add', exact: true }).click();
    dialog = modal(page);
    await dialog.getByPlaceholder('e.g. Tokyo — London BA0007').fill(hotelTitle);
    await dialog.getByRole('button', { name: 'Accommodation', exact: true }).click();
    await dialog.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(startAt));
    await dialog.locator('input[type="datetime-local"]').nth(1).fill(toDateTimeLocal(endAt));
    await dialog.getByRole('button', { name: 'Add Reservation', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(bookingRow(page, hotelTitle)).toBeVisible();

    // ── 5. Transport booking (train) ──────────────────────────────────────────
    await card.getByRole('button', { name: '+ Add', exact: true }).click();
    dialog = modal(page);
    await dialog.getByPlaceholder('e.g. Tokyo — London BA0007').fill(trainTitle);
    await dialog.getByRole('button', { name: 'Train', exact: true }).click();
    await dialog.getByPlaceholder('e.g. Paris Gare du Nord').fill('Paris Gare du Nord');
    await dialog.getByPlaceholder('e.g. London St Pancras').fill('London St Pancras');
    await dialog.getByPlaceholder('e.g. TGV 6201').fill('TGV 6201');
    await dialog.getByRole('button', { name: 'Add Reservation', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const trainRowDesktop = bookingRowDesktop(page, trainTitle);
    const trainRow = bookingRow(page, trainTitle);
    await trainRow.click();
    await expect(trainRowDesktop.getByText('Paris Gare du Nord → London St Pancras · TGV 6201')).toBeVisible();

    // ── 6. Delete the generic reservation ─────────────────────────────────────
    const deletingRow = bookingRow(page, genericTitle);
    await deletingRow.getByRole('button', { name: 'Delete reservation' }).click({ force: true });
    const confirmDialog = modal(page);
    await expect(modalTitle(page).getByText('Delete Reservation', { exact: true })).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(bookingRow(page, genericTitle)).not.toBeVisible();
  });
});
