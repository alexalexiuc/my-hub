import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  uniqueName,
  toDateTimeLocal,
  createTrip,
  selectTrip,
  getTripIdByName,
  openTripSwitcher,
  modal,
  modalDesktop,
  modalTitle,
} from './travel-helpers';

/**
 * Adds a reservation via the BookingModal ("+ Add" on the Reservations card).
 * The modal is shared across all Travel pages that render BookingsSection / TripSwitcher's
 * "Add Booking" action — here we trigger it from the Itinerary page's nav-level "Add Booking".
 */
async function addBookingViaModal(
  page: Page,
  opts: { title: string; type?: string; startAt?: Date; endAt?: Date },
): Promise<void> {
  await page.locator('[data-layout="desktop"]').getByRole('button', { name: 'Add Booking' }).click();
  const dialog = modal(page);
  await expect(modalTitle(page).getByText('Add Reservation', { exact: true })).toBeVisible();
  await dialog.getByPlaceholder('e.g. Tokyo — London BA0007').fill(opts.title);
  if (opts.type) {
    await dialog.getByRole('button', { name: opts.type, exact: true }).click();
  }
  if (opts.startAt) {
    await dialog.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(opts.startAt));
  }
  if (opts.endAt) {
    await dialog.locator('input[type="datetime-local"]').nth(1).fill(toDateTimeLocal(opts.endAt));
  }
  await dialog.getByRole('button', { name: 'Add Reservation', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test.describe('Travel – Itinerary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Trip lifecycle: create, edit, and delete a trip via the TripSwitcher dropdown.
   * Covers TripModal (create/edit) and the ConfirmModal delete confirmation —
   * the redesigned trip-management surface (sidebar list + inline forms are gone).
   */
  test('trip lifecycle: create, edit, and delete via the trip switcher', async ({ page }) => {
    const tripName = uniqueName('E2E Itinerary Trip');
    const editedTripName = `${tripName} Updated`;

    await createTrip(page, tripName);
    await expect(page.locator('div.relative.mb-5 > button').first()).toContainText(tripName);

    // ── Edit trip ──────────────────────────────────────────────────────────────
    const dropdown = await openTripSwitcher(page);
    const tripRow = dropdown.locator('div.group').filter({ hasText: tripName }).first();
    await tripRow.hover();
    await tripRow.getByTitle('Edit trip').click({ force: true });

    const editDialog = modal(page);
    await expect(modalDesktop(page).getByText('Edit Trip', { exact: true })).toBeVisible();
    await editDialog.getByPlaceholder('e.g. Tokyo 2026').fill(editedTripName);
    await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editDialog).not.toBeVisible();
    await expect(page.locator('div.relative.mb-5 > button').first()).toContainText(editedTripName);

    // ── Delete trip ────────────────────────────────────────────────────────────
    const dropdown2 = await openTripSwitcher(page);
    const editedRow = dropdown2.locator('div.group').filter({ hasText: editedTripName }).first();
    await editedRow.hover();
    await editedRow.getByTitle('Delete trip').click({ force: true });

    const confirmDialog = modal(page);
    await expect(modalTitle(page).getByText('Delete Trip', { exact: true })).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmDialog).not.toBeVisible();

    await openTripSwitcher(page);
    await expect(page.getByRole('button', { name: new RegExp(editedTripName) })).not.toBeVisible();
  });

  /**
   * Itinerary chips: an accommodation booking with start+end produces Check-in/Check-out
   * chips with a nights badge; a taxi booking with start only produces a Pickup chip and
   * no Drop-off chip. Also exercises Day by Day note add/edit/delete on the same trip.
   */
  test('itinerary shows reservation chips and supports day-by-day notes', async ({ page }) => {
    const tripName = uniqueName('E2E Itinerary Chips Trip');
    const hotelTitle = uniqueName('Hotel Roma');
    const taxiTitle = uniqueName('Airport Taxi');
    const now = new Date();
    const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const endAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const taxiStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);

    await addBookingViaModal(page, { title: hotelTitle, type: 'Accommodation', startAt, endAt });
    const itinerary = page
      .getByRole('heading', { name: 'Itinerary' })
      .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
    await expect(itinerary).toBeVisible();
    await expect(itinerary.getByText('Check-in', { exact: true })).toBeVisible();
    await expect(itinerary.getByText('Check-out', { exact: true })).toBeVisible();
    await expect(itinerary.getByText(/\d+ nights?/)).toBeVisible();

    await addBookingViaModal(page, { title: taxiTitle, type: 'Taxi', startAt: taxiStart });
    await expect(itinerary.getByText('Pickup', { exact: true })).toBeVisible();
    await expect(itinerary.getByText('Drop-off', { exact: true })).not.toBeVisible();

    // ── Day by Day: set trip dates so days render, then exercise note CRUD ─────
    const tripStartAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60_000);
    const tripEndAt = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 60_000);
    await page.request.patch(`/api/travel/trips/${tripId}`, {
      data: { startAt: tripStartAt.toISOString(), endAt: tripEndAt.toISOString() },
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectTrip(page, tripName);

    const dayByDay = page
      .getByRole('heading', { name: 'Day by Day' })
      .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
    await expect(dayByDay).toBeVisible();

    await dayByDay.getByRole('button', { name: '+ Add notes' }).first().click();
    const noteDialog = modal(page);
    await expect(modalDesktop(page).getByText(/^Notes — /)).toBeVisible();
    await noteDialog.getByPlaceholder('optional heading for the day').fill('Arrival day');
    await noteDialog.locator('.rte-content [contenteditable="true"]').click();
    await noteDialog
      .locator('.rte-content [contenteditable="true"]')
      .pressSequentially('Pick up rental car, check in.');
    await noteDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(noteDialog).not.toBeVisible();

    await expect(dayByDay.getByText('Arrival day')).toBeVisible();
    await expect(dayByDay.getByText('Pick up rental car, check in.')).toBeVisible();

    // ── Edit note ───────────────────────────────────────────────────────────────
    await dayByDay.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const editNoteDialog = modal(page);
    await editNoteDialog.getByPlaceholder('optional heading for the day').fill('Travel day');
    await editNoteDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editNoteDialog).not.toBeVisible();
    await expect(dayByDay.getByText('Travel day')).toBeVisible();
    await expect(dayByDay.getByText('Arrival day')).not.toBeVisible();

    // ── Delete note ─────────────────────────────────────────────────────────────
    await dayByDay.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const deleteNoteDialog = modal(page);
    await deleteNoteDialog.getByRole('button', { name: 'Delete note', exact: true }).click();
    await expect(deleteNoteDialog).not.toBeVisible();
    await expect(dayByDay.getByText('Travel day')).not.toBeVisible();
    await expect(dayByDay.getByRole('button', { name: '+ Add notes' }).first()).toBeVisible();
  });

  /**
   * ComingNext time-state chips: bookings at different time offsets produce correct
   * chip counts and styling (past collapsed, imminent "Soon!" badge, future plain).
   * Kept separate — relies on precise relative timestamps and would be fragile if
   * interleaved with other booking mutations on the same trip.
   */
  test('itinerary shows time-state styling for bookings at different offsets', async ({ page }) => {
    const tripName = uniqueName('E2E ComingNext Chips');
    const now = new Date();

    const pastStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const pastEnd = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const imminentStart = new Date(now.getTime() + 30 * 60 * 1000);
    const futureStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    await createTrip(page, tripName);

    await addBookingViaModal(page, { title: 'Past Hotel', type: 'Accommodation', startAt: pastStart, endAt: pastEnd });
    await addBookingViaModal(page, { title: 'Imminent Flight', type: 'Flight', startAt: imminentStart });
    await addBookingViaModal(page, { title: 'Future Tour', type: 'Tour', startAt: futureStart });

    const itinerary = page
      .getByRole('heading', { name: 'Itinerary' })
      .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
    await expect(itinerary).toBeVisible();

    const pastHotelChips = itinerary.getByRole('button', { name: /Expand past segment: Past Hotel/ });
    await expect(pastHotelChips).toHaveCount(2);
    await expect(pastHotelChips.first()).toContainText('Past Hotel');

    await pastHotelChips.first().click();
    await expect(itinerary.getByText('Past Hotel').first()).toBeVisible();

    await expect(itinerary.getByText('Imminent Flight')).toHaveCount(1);
    await expect(itinerary.getByText('Soon!')).toBeVisible();

    await expect(itinerary.getByText('Future Tour')).toHaveCount(1);
  });
});
