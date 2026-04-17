import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SHARED_TRIP_FIXTURE } from '../constants';

/** Format a Date for a datetime-local input value (local time, no seconds). */
function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function reservationRowLocator(page: Page, title: string) {
  return page.getByRole('button', { name: new RegExp(`(Expand|Collapse) reservation: ${title}`) }).first();
}

async function ensureUserExists(page: Page, email: string, password: string, name: string) {
  const res = await page.request.post('/api/auth/register', {
    data: { email, password, name },
  });
  expect([201, 409]).toContain(res.status());
}

async function createTrip(page: Page, tripName: string): Promise<void> {
  await page.getByPlaceholder('Trip name').first().fill(tripName);
  await page.getByPlaceholder('Destination').first().fill('Rome');
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page.getByRole('button', { name: new RegExp(tripName) })).toBeVisible();
}

async function getTripIdByName(page: Page, tripName: string): Promise<number> {
  const res = await page.request.get('/api/travel/trips');
  expect(res.ok()).toBeTruthy();
  const data = (await res.json()) as { trips: Array<{ id: number; name: string }> };
  const trip = data.trips.find(t => t.name === tripName);
  expect(trip).toBeTruthy();
  return trip!.id;
}

test.describe('Travel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Full trip journey: a single trip progresses through every feature in a natural order.
   * Covers: create, owner label, sharing, edit name, reservations (generic + flight + accommodation + taxi),
   * flight details display, edit flight, itinerary chips, document upload + attachment indicator,
   * map with geo bookings, sidebar date range, checklist CRUD + edit/cancel, companion CRUD + edit/cancel,
   * Day by Day section, day note add/edit/delete, and trip deletion.
   */
  test('full trip journey: create through delete covering all features', async ({ page }) => {
    const tripName = uniqueName('E2E Journey Trip');
    const editedTripName = `${tripName} Updated`;
    const sharedEmail = 'e2e-mcp@test.local';
    const flightBookingTitle = uniqueName('London to Paris Flight');
    const hotelBookingTitle = uniqueName('Hotel Roma');
    const taxiBookingTitle = 'Airport Pickup';
    const genericBookingTitle = uniqueName('Generic Booking');
    const documentTitle = uniqueName('Boarding Doc');
    const checklistTitle = uniqueName('Pack Charger');
    const companionName = uniqueName('Alex Companion');
    const now = new Date();
    const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const endAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const taxiStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // ── 1. Create trip ────────────────────────────────────────────────────────
    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) });
    await tripButton.click();

    // ── 2. Owner label + sharing controls visible ─────────────────────────────
    await expect(tripButton).toContainText('Owner: You');
    await expect(page.getByPlaceholder('Share with user email')).toBeVisible();
    await expect(page.getByPlaceholder('Share with user email')).toBeEnabled();

    // ── 3. Share trip + revoke ────────────────────────────────────────────────
    await ensureUserExists(page, sharedEmail, 'E2eMcpPass123!', 'E2E MCP User');

    const sharingSection = page.getByRole('heading', { name: 'Sharing' }).locator('xpath=ancestor::section[1]');
    const removeButtons = sharingSection.getByRole('button', { name: 'Remove', exact: true });
    const beforeCount = await removeButtons.count();

    await sharingSection.getByPlaceholder('Share with user email').fill(sharedEmail);
    const shareResponsePromise = page.waitForResponse(
      res =>
        res.url().includes('/api/travel/trips/') && res.url().includes('/shares') && res.request().method() === 'POST',
    );
    await sharingSection.getByRole('button', { name: 'Share', exact: true }).click();
    const shareResponse = await shareResponsePromise;
    expect(shareResponse.status()).toBe(201);
    await expect(removeButtons).toHaveCount(beforeCount + 1);

    const revokeResponsePromise = page.waitForResponse(
      res =>
        res.url().includes('/api/travel/trips/') &&
        res.url().includes('/shares/') &&
        res.request().method() === 'DELETE',
    );
    await removeButtons.nth(beforeCount).click();
    const revokeResponse = await revokeResponsePromise;
    expect(revokeResponse.status()).toBe(200);
    await expect(removeButtons).toHaveCount(beforeCount);

    // ── 4. Edit trip name ─────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Edit trip' }).first().click();
    await page.locator('input[placeholder="Trip name"]').nth(1).fill(editedTripName);
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByRole('button', { name: new RegExp(editedTripName) })).toBeVisible();

    // ── 5. Generic reservation: expand / collapse ─────────────────────────────
    const reservationsSection = page
      .getByRole('heading', { name: 'Reservations' })
      .locator('xpath=ancestor::section[1]');

    await reservationsSection.getByPlaceholder('Reservation title').fill(genericBookingTitle);
    await reservationsSection.getByPlaceholder('Provider').fill('Test Provider');
    await reservationsSection.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: genericBookingTitle })).toBeVisible();

    const genericRow = reservationRowLocator(page, genericBookingTitle);
    await expect(genericRow).toBeVisible();
    await genericRow.click();
    await expect(genericRow).toHaveAttribute('aria-expanded', 'true');
    await genericRow.click();
    await expect(genericRow).toHaveAttribute('aria-expanded', 'false');

    // ── 6. Flight booking: add with full details ──────────────────────────────
    await reservationsSection.getByPlaceholder('Reservation title').fill(flightBookingTitle);
    await reservationsSection.locator('select').first().selectOption('flight');
    await reservationsSection.getByPlaceholder('Flight no. (e.g. BA2490)').fill('BA2490');
    await reservationsSection.getByPlaceholder('Seat (e.g. 14A)').fill('14A');
    await reservationsSection.getByPlaceholder('From IATA (e.g. LHR)').fill('LHR');
    await reservationsSection.getByPlaceholder('To IATA (e.g. CDG)').fill('CDG');
    await reservationsSection.getByPlaceholder('Terminal').fill('3');
    await reservationsSection.getByPlaceholder('Gate').fill('B25');
    await reservationsSection.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: flightBookingTitle })).toBeVisible();

    // Verify flight details in expanded panel
    const flightRow = reservationRowLocator(page, flightBookingTitle);
    await flightRow.click();
    await expect(page.getByText(/BA2490/i)).toBeVisible();
    await expect(page.getByText('LHR→CDG')).toBeVisible();
    await expect(page.getByText(/Seat 14A/i)).toBeVisible();
    await expect(page.getByText(/T3/i)).toBeVisible();
    await expect(page.getByText(/Gate B25/i)).toBeVisible();

    // ── 7. Edit flight booking ────────────────────────────────────────────────
    await flightRow.getByRole('button', { name: 'Edit reservation' }).click();
    // In edit mode the title becomes an <input>, so hasText won't match it.
    // Filter by the presence of the flight-specific placeholder instead.
    const editingBookingRow = page.getByTestId('booking-row').filter({
      has: page.getByPlaceholder('Flight no. (e.g. BA2490)'),
    });
    await editingBookingRow.getByPlaceholder('Flight no. (e.g. BA2490)').fill('BA2491');
    await editingBookingRow.getByPlaceholder('Seat (e.g. 14A)').fill('15B');
    await editingBookingRow.getByRole('button', { name: 'Save', exact: true }).click();

    // Row was already expanded before edit; after save it remains expanded.
    await expect(page.getByText(/BA2491/i)).toBeVisible();
    await expect(page.getByText(/Seat 15B/i)).toBeVisible();

    // ── 8. Accommodation with dates: itinerary two chips ──────────────────────
    await reservationsSection.getByPlaceholder('Reservation title').fill(hotelBookingTitle);
    await reservationsSection.locator('select').first().selectOption('accommodation');
    await reservationsSection.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(startAt));
    await reservationsSection.locator('input[type="datetime-local"]').nth(1).fill(toDateTimeLocal(endAt));
    await reservationsSection.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: hotelBookingTitle })).toBeVisible();

    const itinerary = page.getByRole('heading', { name: 'Itinerary' }).locator('xpath=ancestor::section[1]');
    await expect(itinerary).toBeVisible();
    await expect(itinerary.getByText('Check-in', { exact: true })).toBeVisible();
    await expect(itinerary.getByText('Check-out', { exact: true })).toBeVisible();
    await expect(itinerary.getByText(/\d+ nights?/)).toBeVisible();

    // ── 9. Taxi booking without endAt: itinerary one chip ─────────────────────
    await reservationsSection.getByPlaceholder('Reservation title').fill(taxiBookingTitle);
    await reservationsSection.locator('select').first().selectOption('taxi');
    await reservationsSection.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(taxiStart));
    await reservationsSection.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: taxiBookingTitle })).toBeVisible();
    await expect(itinerary.getByText('Pickup', { exact: true })).toBeVisible();
    await expect(itinerary.getByText('Drop-off', { exact: true })).not.toBeVisible();

    // ── 10. Sidebar date range ────────────────────────────────────────────────
    // The accommodation booking with startAt/endAt should update the trip card date range.
    await page.reload();
    await page.waitForLoadState('networkidle');

    const updatedTripButton = page.getByRole('button', { name: new RegExp(editedTripName) }).first();
    const updatedTripCard = updatedTripButton.locator('xpath=ancestor::div[contains(@class,"rounded-lg")]').first();
    await expect(updatedTripCard).not.toContainText('Reservation dates not set');
    await expect(updatedTripCard).toContainText('->');

    // Re-open the trip for subsequent steps
    await updatedTripButton.click();

    // ── 11. Document upload linked to hotel booking ───────────────────────────
    const documentsSection = page.getByRole('heading', { name: 'Documents' }).locator('xpath=ancestor::section[1]');

    await documentsSection.getByPlaceholder('Document title').fill(documentTitle);
    await documentsSection.locator('input[type="file"]').setInputFiles({
      name: 'travel-doc.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504E470D0A1A0A', 'hex'),
    });
    const bookingLinkSelect = documentsSection
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Link to reservation (optional)' }) })
      .first();
    await bookingLinkSelect.selectOption({ label: hotelBookingTitle });
    const uploadButton = documentsSection.getByRole('button', { name: 'Upload Document' });
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();

    await expect(page.locator('p.font-medium', { hasText: documentTitle })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Linked to: ${hotelBookingTitle}`)).toBeVisible();

    const hotelRow = reservationRowLocator(page, hotelBookingTitle);
    await expect(hotelRow.locator('span[title="Has attachments"]').first()).toBeVisible();
    await hotelRow.click();
    const documentDownloadLink = page.getByRole('link', { name: documentTitle }).first();
    await expect(documentDownloadLink).toBeVisible();
    const href = await documentDownloadLink.getAttribute('href');
    expect(href).toBeTruthy();
    const downloadRes = await page.request.get(href!);
    expect(downloadRes.ok()).toBeTruthy();

    // ── 12. Map: geo bookings via API ─────────────────────────────────────────
    const tripId = await getTripIdByName(page, editedTripName);
    const geoRes1 = await page.request.post('/api/travel/bookings', {
      data: { tripId, title: 'Paris Hotel', bookingType: 'accommodation', lat: 48.8566, lng: 2.3522 },
    });
    expect(geoRes1.status()).toBe(201);
    const b1 = (await geoRes1.json()) as { booking: { lat: number | null } };
    expect(b1.booking.lat).toBe(48.8566);

    const geoRes2 = await page.request.post('/api/travel/bookings', {
      data: { tripId, title: 'Rome Hotel', bookingType: 'accommodation', lat: 41.9028, lng: 12.4964 },
    });
    expect(geoRes2.status()).toBe(201);

    await page.reload();
    await page.waitForLoadState('networkidle');

    const overviewResponsePromise = page.waitForResponse(
      res => res.url().includes(`/api/travel/trips/${tripId}/overview`) && res.status() === 200,
    );
    await page.getByRole('button', { name: new RegExp(editedTripName) }).click();
    await overviewResponsePromise;

    await page.getByRole('button', { name: 'Show map' }).click();
    await expect(page.locator('[data-testid="trip-map-container"]')).toBeVisible({ timeout: 10_000 });

    // ── 13. Checklist: add, toggle done, edit, cancel ─────────────────────────
    const checklistSection = page.getByRole('heading', { name: 'Checklist' }).locator('xpath=ancestor::section[1]');
    await checklistSection.getByPlaceholder('Add checklist item').fill(checklistTitle);
    await checklistSection.getByRole('button', { name: 'Add', exact: true }).click();

    const checklistItemButton = checklistSection.getByRole('button', { name: checklistTitle }).first();
    await expect(checklistItemButton).toBeVisible();
    await checklistItemButton.click();
    await expect(checklistItemButton).toHaveClass(/line-through/);

    // Edit checklist item
    const updatedChecklistTitle = `${checklistTitle} Updated`;
    await checklistSection.getByRole('button', { name: 'Edit checklist item' }).first().click();
    await expect(checklistSection.locator('input')).toHaveCount(2);
    await checklistSection.locator('input').nth(1).fill(updatedChecklistTitle);
    await checklistSection.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(
      checklistSection.getByRole('button', { name: new RegExp(`^${updatedChecklistTitle}$`) }),
    ).toBeVisible();
    await expect(checklistSection.getByRole('button', { name: new RegExp(`^${checklistTitle}$`) })).not.toBeVisible();

    // Cancel edit preserves value
    await checklistSection.getByRole('button', { name: 'Edit checklist item' }).first().click();
    await checklistSection.locator('input').nth(1).fill(`${updatedChecklistTitle} Draft`);
    await checklistSection.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await expect(
      checklistSection.getByRole('button', { name: new RegExp(`^${updatedChecklistTitle}$`) }),
    ).toBeVisible();
    await expect(
      checklistSection.getByRole('button', { name: new RegExp(`^${updatedChecklistTitle} Draft$`) }),
    ).not.toBeVisible();

    // ── 14. Companion: add, edit, cancel ──────────────────────────────────────
    const companionsSection = page.getByRole('heading', { name: 'Companions' }).locator('xpath=ancestor::section[1]');
    await companionsSection.getByPlaceholder('Name').fill(companionName);
    await companionsSection.getByPlaceholder('Email').fill('original-companion@test.local');
    await companionsSection.getByRole('button', { name: 'Add Companion' }).click();
    await expect(companionsSection.locator('p.font-medium', { hasText: companionName }).first()).toBeVisible();

    const updatedCompanionName = `${companionName} Updated`;
    await companionsSection.getByRole('button', { name: 'Edit companion' }).first().click();
    await expect(companionsSection.locator('input')).toHaveCount(6);
    await companionsSection.locator('input').nth(3).fill(updatedCompanionName);
    await companionsSection.locator('input').nth(4).fill('updated-companion@test.local');
    await companionsSection.locator('input').nth(5).fill('+40123456789');
    await companionsSection.getByRole('button', { name: 'Save', exact: true }).first().click();

    const updatedCompanionCard = companionsSection
      .locator('div.rounded-md.border.border-zinc-700.bg-zinc-900.px-3.py-2.text-sm')
      .filter({ has: page.locator('p.font-medium', { hasText: updatedCompanionName }) })
      .first();
    await expect(updatedCompanionCard).toBeVisible();
    await expect(updatedCompanionCard).toContainText('updated-companion@test.local');

    // Cancel edit preserves value
    await companionsSection.getByRole('button', { name: 'Edit companion' }).first().click();
    await companionsSection.locator('input').nth(3).fill(`${updatedCompanionName} Draft`);
    await companionsSection.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await expect(updatedCompanionCard).toContainText(updatedCompanionName);
    await expect(updatedCompanionCard).not.toContainText(`${updatedCompanionName} Draft`);

    // ── 15. Day by Day: section + note CRUD ───────────────────────────────────
    const tripStartAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 1000 * 60);
    const tripEndAt = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 1000 * 60);
    await page.request.patch(`/api/travel/trips/${tripId}`, {
      data: { startAt: tripStartAt.toISOString(), endAt: tripEndAt.toISOString() },
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('button', { name: new RegExp(editedTripName) })
      .first()
      .click();

    const dayByDay = page.getByRole('heading', { name: 'Day by Day' }).locator('xpath=ancestor::section[1]');
    await expect(dayByDay).toBeVisible();

    await dayByDay.getByRole('button', { name: '+ Add notes' }).first().click();
    await dayByDay.locator('input[placeholder="Day title (optional)"]').fill('Arrival day');
    await dayByDay.locator('textarea').fill('Pick up rental car, check in.');
    await dayByDay.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(dayByDay.locator('p').filter({ hasText: 'Arrival day' })).toBeVisible();
    await expect(dayByDay.locator('p').filter({ hasText: 'Pick up rental car, check in.' })).toBeVisible();

    await dayByDay.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await dayByDay.locator('input[placeholder="Day title (optional)"]').fill('Travel day');
    await dayByDay.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(dayByDay.getByText('Travel day')).toBeVisible();
    await expect(dayByDay.getByText('Arrival day')).not.toBeVisible();

    await dayByDay.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await dayByDay.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await expect(dayByDay.getByText('Travel day')).not.toBeVisible();
    await expect(dayByDay.getByRole('button', { name: '+ Add notes' }).first()).toBeVisible();

    // ── 16. Delete trip ───────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Remove trip' }).first().click();
    await expect(page.getByRole('button', { name: new RegExp(editedTripName) })).not.toBeVisible();
  });

  /**
   * ComingNext time-state chips: bookings at different time offsets produce correct
   * chip counts and styling (past collapsed, imminent "Soon!" badge, future plain).
   * Kept separate because it relies on precise relative timestamps.
   */
  test('ComingNext shows chips for multiple bookings with correct time-state styling', async ({ page }) => {
    const tripName = uniqueName('E2E ComingNext Chips');
    const now = new Date();

    const pastStart = new Date(now.getTime() - 5 * 60 * 60 * 1000); // 5h ago
    const pastEnd = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3h ago
    const imminentStart = new Date(now.getTime() + 30 * 60 * 1000); // +30 min
    const futureStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) });
    await tripButton.click();

    // Booking with start + end → should produce 2 chips (start chip + end chip)
    await page.getByPlaceholder('Reservation title').fill('Past Hotel');
    await page.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(pastStart));
    await page.locator('input[type="datetime-local"]').nth(1).fill(toDateTimeLocal(pastEnd));
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium, button', { hasText: /Past Hotel/ }).first()).toBeVisible();

    // Booking with start only → should produce exactly 1 chip
    await page.getByPlaceholder('Reservation title').fill('Imminent Flight');
    await page.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(imminentStart));
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium, button', { hasText: /Imminent Flight/ }).first()).toBeVisible();

    // Another future booking (start only)
    await page.getByPlaceholder('Reservation title').fill('Future Tour');
    await page.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(futureStart));
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium, button', { hasText: /Future Tour/ }).first()).toBeVisible();

    const comingNext = page.getByRole('heading', { name: 'Itinerary' }).locator('xpath=ancestor::section[1]');
    await expect(comingNext).toBeVisible();

    const pastHotelChips = comingNext.getByRole('button', { name: /Expand past segment: Past Hotel/ });
    await expect(pastHotelChips).toHaveCount(2);
    await expect(pastHotelChips.first()).toContainText('Past Hotel');

    await pastHotelChips.first().click();
    await expect(comingNext.getByText('Past Hotel').first()).toBeVisible();

    const imminentChips = comingNext.getByText('Imminent Flight');
    await expect(imminentChips).toHaveCount(1);
    await expect(comingNext.getByText('Soon!')).toBeVisible();

    await expect(comingNext.getByText('Future Tour')).toHaveCount(1);
  });

  /**
   * Cancelled trip visibility: a cancelled trip is hidden in the Upcoming filter
   * and visible again under All. Kept separate — cancelling the main flow trip
   * would interfere with the rest of that test.
   */
  test('sidebar Upcoming filter hides cancelled trips and All shows them', async ({ page }) => {
    const tripName = uniqueName('E2E Cancelled Trip');

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) }).first();
    await expect(tripButton).toBeVisible();

    const tripId = await getTripIdByName(page, tripName);
    const cancelRes = await page.request.patch(`/api/travel/trips/${tripId}`, {
      data: { cancelledAt: new Date().toISOString() },
    });
    expect(cancelRes.status()).toBe(200);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Upcoming', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(tripName) })).not.toBeVisible();

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(tripName) })).toBeVisible();
  });

  /**
   * Shared trip read-only view: uses the seeded SHARED_TRIP_FIXTURE trip; verifies
   * that a viewer sees the owner name, the read-only message, and the seeded booking,
   * but cannot add reservations.
   */
  test('shows a seeded shared trip in read-only mode for the viewer', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('networkidle');

    const tripButton = page.getByRole('button', { name: new RegExp(SHARED_TRIP_FIXTURE.tripName) });
    await expect(tripButton).toBeVisible();
    await tripButton.click();

    await expect(tripButton).toContainText(`Owner: ${SHARED_TRIP_FIXTURE.ownerName}`);
    await expect(
      page.getByText('Only the trip owner can manage sharing. You currently have view-only access.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Reservation' })).toBeDisabled();
    await expect(page.locator('p.font-medium', { hasText: SHARED_TRIP_FIXTURE.bookingTitle })).toBeVisible();
  });
});
