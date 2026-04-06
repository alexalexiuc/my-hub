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
  const trip = data.trips.find((t) => t.name === tripName);
  expect(trip).toBeTruthy();
  return trip!.id;
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

  test('shares a trip by email and revokes that share', async ({ page }) => {
    const tripName = uniqueName('E2E Share Trip');
    const sharedEmail = 'e2e-mcp@test.local';

    await ensureUserExists(page, sharedEmail, 'E2eMcpPass123!', 'E2E MCP User');

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) });
    await tripButton.click();

    const sharingSection = page.getByRole('heading', { name: 'Sharing' }).locator('xpath=ancestor::section[1]');
    await expect(sharingSection.getByPlaceholder('Share with user email')).toBeVisible();

    const removeButtons = sharingSection.getByRole('button', { name: 'Remove', exact: true });
    const beforeCount = await removeButtons.count();

    await sharingSection.getByPlaceholder('Share with user email').fill(sharedEmail);
    const shareResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/travel/trips/') && res.url().includes('/shares') && res.request().method() === 'POST',
    );
    await sharingSection.getByRole('button', { name: 'Share', exact: true }).click();
    const shareResponse = await shareResponsePromise;
    expect(shareResponse.status()).toBe(201);

    await expect(removeButtons).toHaveCount(beforeCount + 1);

    const revokeResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/travel/trips/') &&
        res.url().includes('/shares/') &&
        res.request().method() === 'DELETE',
    );
    await removeButtons.nth(beforeCount).click();
    const revokeResponse = await revokeResponsePromise;
    expect(revokeResponse.status()).toBe(200);

    await expect(removeButtons).toHaveCount(beforeCount);
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
    const bookingRow = reservationRowLocator(page, bookingTitle);
    await expect(bookingRow).toBeVisible();

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

    await bookingRow.getByRole('button', { name: 'Remove reservation' }).click();
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

    const bookingRow = reservationRowLocator(page, bookingTitle);
    await expect(bookingRow).toBeVisible();

    const attachmentIndicator = bookingRow.locator('span[title="Has attachments"]').first();
    await expect(attachmentIndicator).toBeVisible();

    await bookingRow.click();
    const documentDownloadLink = page.getByRole('link', { name: documentTitle }).first();
    await expect(documentDownloadLink).toBeVisible();

    const href = await documentDownloadLink.getAttribute('href');
    expect(href).toBeTruthy();
    const downloadRes = await page.request.get(href!);
    expect(downloadRes.ok()).toBeTruthy();
  });

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

  test('adds flight booking with details and displays them properly', async ({ page }) => {
    const tripName = uniqueName('E2E Flight Details Trip');
    const flightBookingTitle = uniqueName('London to Paris Flight');
    const flightNumber = 'BA2490';
    const seat = '14A';
    const originIata = 'LHR';
    const destIata = 'CDG';
    const terminal = '3';
    const gate = 'B25';

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) });
    await tripButton.click();

    // Add a flight booking with all details
    await page.getByPlaceholder('Reservation title').fill(flightBookingTitle);

    // Select "Flight" as booking type
    const bookingTypeSelect = page.locator('select').first();
    await bookingTypeSelect.selectOption('flight');

    // Fill in flight details
    await page.getByPlaceholder('Flight no. (e.g. BA2490)').fill(flightNumber);
    await page.getByPlaceholder('Seat (e.g. 14A)').fill(seat);
    await page.getByPlaceholder('From IATA (e.g. LHR)').fill(originIata);
    await page.getByPlaceholder('To IATA (e.g. CDG)').fill(destIata);
    await page.getByPlaceholder('Terminal').fill(terminal);
    await page.getByPlaceholder('Gate').fill(gate);

    await page.getByRole('button', { name: 'Add Reservation' }).click();

    // Verify the flight booking is created and details are displayed
    await expect(page.locator('p.font-medium', { hasText: flightBookingTitle })).toBeVisible();

    // Flight details render in the expanded reservation panel.
    const bookingRow = reservationRowLocator(page, flightBookingTitle);
    await expect(bookingRow).toBeVisible();
    await bookingRow.click();

    // Verify all flight details are displayed.
    const flightDetailsText = page.getByText(new RegExp(flightNumber, 'i'));
    await expect(flightDetailsText).toBeVisible();

    const routeText = page.getByText(`${originIata}→${destIata}`);
    await expect(routeText).toBeVisible();

    const seatText = page.getByText(new RegExp(`Seat ${seat}`, 'i'));
    await expect(seatText).toBeVisible();

    const terminalText = page.getByText(new RegExp(`T${terminal}`, 'i'));
    await expect(terminalText).toBeVisible();

    const gateText = page.getByText(new RegExp(`Gate ${gate}`, 'i'));
    await expect(gateText).toBeVisible();
  });

  test('shows map button visible when trip has bookings with coordinates and clicking expands map', async ({
    page,
  }) => {
    const tripName = uniqueName('E2E Map Trip');
    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);

    // Create two bookings with lat/lng via API — the UI does not expose coordinate fields.
    // mapData.points requires >= 2 points to render the Leaflet map.
    const res1 = await page.request.post('/api/travel/bookings', {
      data: { trip_id: tripId, title: 'Paris Hotel', booking_type: 'accommodation', lat: 48.8566, lng: 2.3522 },
    });
    expect(res1.status()).toBe(201);
    const b1 = (await res1.json()) as { booking: { lat: number | null } };
    expect(b1.booking.lat).toBe(48.8566);

    const res2 = await page.request.post('/api/travel/bookings', {
      data: { trip_id: tripId, title: 'Rome Hotel', booking_type: 'accommodation', lat: 41.9028, lng: 12.4964 },
    });
    expect(res2.status()).toBe(201);

    // Reload so the overview is fetched fresh with the new bookings (clicking an already-
    // active trip button does not re-trigger loadOverview).
    await page.reload();
    await page.waitForLoadState('networkidle');

    const overviewResponsePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/travel/trips/${tripId}/overview`) && res.status() === 200,
    );
    await page.getByRole('button', { name: new RegExp(tripName) }).click();
    await overviewResponsePromise;

    // Click the map button to expand the map section.
    const mapButton = page.getByRole('button', { name: 'Show map' });
    await mapButton.click();

    // TripMapInner renders a container div only when mapData.points.length >= 2.
    // Asserting the container is visible confirms the API returned valid geo data
    // and the component rendered. Leaflet class attachment depends on external CDN
    // CSS (unpkg), so we only assert the container element, not Leaflet internals.
    await expect(page.locator('[data-testid="trip-map-container"]')).toBeVisible({ timeout: 10_000 });
  });

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
    // Intentionally no endAt
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium, button', { hasText: /Imminent Flight/ }).first()).toBeVisible();

    // Another future booking (start only)
    await page.getByPlaceholder('Reservation title').fill('Future Tour');
    await page.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(futureStart));
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium, button', { hasText: /Future Tour/ }).first()).toBeVisible();

    const comingNext = page.getByRole('heading', { name: 'Itinerary' }).locator('xpath=ancestor::section[1]');
    await expect(comingNext).toBeVisible();

    // "Past Hotel" has both start and end → exactly 2 collapsed past-segment chips.
    // Other chips (e.g. museum between check-in/check-out) may appear between them,
    // so we assert count only, not adjacency.
    const pastHotelChips = comingNext.getByRole('button', { name: /Expand past segment: Past Hotel/ });
    await expect(pastHotelChips).toHaveCount(2);
    await expect(pastHotelChips.first()).toContainText('Past Hotel');

    // Clicking a past chip expands it
    await pastHotelChips.first().click();
    await expect(comingNext.getByText('Past Hotel').first()).toBeVisible();

    // "Imminent Flight" has start only → exactly 1 chip, visible with "Soon!" badge
    const imminentChips = comingNext.getByText('Imminent Flight');
    await expect(imminentChips).toHaveCount(1);
    await expect(comingNext.getByText('Soon!')).toBeVisible();

    // "Future Tour" has start only → exactly 1 chip
    await expect(comingNext.getByText('Future Tour')).toHaveCount(1);
  });

  test('reservation row expands on click to show extra details', async ({ page }) => {
    const tripName = uniqueName('E2E Expand Reservation');
    const bookingTitle = uniqueName('Hotel Expand Test');

    await createTrip(page, tripName);
    await page.getByRole('button', { name: new RegExp(tripName) }).click();

    await page.getByPlaceholder('Reservation title').fill(bookingTitle);
    await page.getByPlaceholder('Provider').fill('Test Provider');
    await page.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: bookingTitle })).toBeVisible();

    // Details should not be visible before expanding
    const bookingRow = reservationRowLocator(page, bookingTitle);
    await expect(bookingRow).toBeVisible();

    // Click to expand
    await bookingRow.click();
    await expect(bookingRow).toHaveAttribute('aria-expanded', 'true');

    // Click again to collapse
    await bookingRow.click();
    await expect(bookingRow).toHaveAttribute('aria-expanded', 'false');
  });

  test('sidebar Upcoming filter hides cancelled trips and All shows them', async ({ page }) => {
    const tripName = uniqueName('E2E Cancelled Trip');

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) }).first();
    await expect(tripButton).toBeVisible();

    const tripId = await getTripIdByName(page, tripName);
    const cancelRes = await page.request.patch(`/api/travel/trips/${tripId}`, {
      data: { cancelled_at: new Date().toISOString() },
    });
    expect(cancelRes.status()).toBe(200);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Upcoming', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(tripName) })).not.toBeVisible();

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(tripName) })).toBeVisible();
  });

  test('sidebar trip card shows booking date range after adding dated reservation', async ({ page }) => {
    const tripName = uniqueName('E2E Sidebar Range');
    const bookingTitle = uniqueName('Range Booking');
    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) }).first();
    const tripCard = tripButton.locator('xpath=ancestor::div[contains(@class,"rounded-lg")]').first();
    await expect(tripCard).toContainText('Reservation dates not set');

    await tripButton.click();
    const reservationsSection = page
      .getByRole('heading', { name: 'Reservations' })
      .locator('xpath=ancestor::section[1]');
    await reservationsSection.getByPlaceholder('Reservation title').fill(bookingTitle);
    await reservationsSection.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(startAt));
    await reservationsSection.locator('input[type="datetime-local"]').nth(1).fill(toDateTimeLocal(endAt));
    await reservationsSection.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: bookingTitle })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const updatedTripButton = page.getByRole('button', { name: new RegExp(tripName) }).first();
    const updatedTripCard = updatedTripButton.locator('xpath=ancestor::div[contains(@class,"rounded-lg")]').first();
    await expect(updatedTripCard).not.toContainText('Reservation dates not set');
    await expect(updatedTripCard).toContainText('->');
  });

  test('edits checklist item and preserves title on cancel', async ({ page }) => {
    const tripName = uniqueName('E2E Checklist Edit Trip');
    const checklistTitle = uniqueName('Original Checklist');
    const updatedChecklistTitle = `${checklistTitle} Updated`;

    await createTrip(page, tripName);
    await page.getByRole('button', { name: new RegExp(tripName) }).click();

    const checklistSection = page.getByRole('heading', { name: 'Checklist' }).locator('xpath=ancestor::section[1]');
    await checklistSection.getByPlaceholder('Add checklist item').fill(checklistTitle);
    await checklistSection.getByRole('button', { name: 'Add', exact: true }).click();

    const checklistItemButton = checklistSection.getByRole('button', { name: checklistTitle }).first();
    await expect(checklistItemButton).toBeVisible();
    await checklistSection.getByRole('button', { name: 'Edit checklist item' }).first().click();

    await expect(checklistSection.locator('input')).toHaveCount(2);
    await checklistSection.locator('input').nth(1).fill(updatedChecklistTitle);
    await checklistSection.getByRole('button', { name: 'Save', exact: true }).first().click();

    await expect(
      checklistSection.getByRole('button', { name: new RegExp(`^${updatedChecklistTitle}$`) }),
    ).toBeVisible();
    await expect(checklistSection.getByRole('button', { name: new RegExp(`^${checklistTitle}$`) })).not.toBeVisible();

    await checklistSection.getByRole('button', { name: 'Edit checklist item' }).first().click();
    await expect(checklistSection.locator('input')).toHaveCount(2);
    await checklistSection.locator('input').nth(1).fill(`${updatedChecklistTitle} Draft`);
    await checklistSection.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    await expect(
      checklistSection.getByRole('button', { name: new RegExp(`^${updatedChecklistTitle}$`) }),
    ).toBeVisible();
    await expect(
      checklistSection.getByRole('button', { name: new RegExp(`^${updatedChecklistTitle} Draft$`) }),
    ).not.toBeVisible();
  });

  test('edits companion details and preserves values on cancel', async ({ page }) => {
    const tripName = uniqueName('E2E Companion Edit Trip');
    const companionName = uniqueName('Original Companion');
    const updatedCompanionName = `${companionName} Updated`;

    await createTrip(page, tripName);
    await page.getByRole('button', { name: new RegExp(tripName) }).click();

    const companionsSection = page.getByRole('heading', { name: 'Companions' }).locator('xpath=ancestor::section[1]');
    await companionsSection.getByPlaceholder('Name').fill(companionName);
    await companionsSection.getByPlaceholder('Email').fill('original-companion@test.local');
    await companionsSection.getByRole('button', { name: 'Add Companion' }).click();

    await expect(companionsSection.locator('p.font-medium', { hasText: companionName }).first()).toBeVisible();

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

    await companionsSection.getByRole('button', { name: 'Edit companion' }).first().click();
    await expect(companionsSection.locator('input')).toHaveCount(6);
    await companionsSection.locator('input').nth(3).fill(`${updatedCompanionName} Draft`);
    await companionsSection.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    await expect(updatedCompanionCard).toContainText(updatedCompanionName);
    await expect(updatedCompanionCard).not.toContainText(`${updatedCompanionName} Draft`);
  });

  test('Itinerary renders two chips with endpoint labels when endAt is set', async ({ page }) => {
    const tripName = uniqueName('E2E Two Chips');
    const now = new Date();
    const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days
    const endAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 days

    await createTrip(page, tripName);
    await page.getByRole('button', { name: new RegExp(tripName) }).click();

    // Add accommodation with both start and end times
    const reservationsSection = page
      .getByRole('heading', { name: 'Reservations' })
      .locator('xpath=ancestor::section[1]');
    await reservationsSection.getByPlaceholder('Reservation title').fill('Hotel Roma');
    await reservationsSection.locator('select').first().selectOption('accommodation');
    await reservationsSection.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(startAt));
    await reservationsSection.locator('input[type="datetime-local"]').nth(1).fill(toDateTimeLocal(endAt));
    await reservationsSection.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: 'Hotel Roma' })).toBeVisible();

    const itinerary = page.getByRole('heading', { name: 'Itinerary' }).locator('xpath=ancestor::section[1]');
    await expect(itinerary).toBeVisible();

    // Both endpoint labels should be present
    await expect(itinerary.getByText('Check-in', { exact: true })).toBeVisible();
    await expect(itinerary.getByText('Check-out', { exact: true })).toBeVisible();

    // Duration badge should show nights count
    await expect(itinerary.getByText(/\d+ nights?/)).toBeVisible();
  });

  test('Itinerary renders one chip when endAt is null', async ({ page }) => {
    const tripName = uniqueName('E2E One Chip');
    const startAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await createTrip(page, tripName);
    await page.getByRole('button', { name: new RegExp(tripName) }).click();

    const reservationsSection = page
      .getByRole('heading', { name: 'Reservations' })
      .locator('xpath=ancestor::section[1]');
    await reservationsSection.getByPlaceholder('Reservation title').fill('Airport Pickup');
    await reservationsSection.locator('select').first().selectOption('taxi');
    await reservationsSection.locator('input[type="datetime-local"]').first().fill(toDateTimeLocal(startAt));
    // Intentionally no endAt
    await reservationsSection.getByRole('button', { name: 'Add Reservation' }).click();
    await expect(page.locator('p.font-medium', { hasText: 'Airport Pickup' })).toBeVisible();

    const itinerary = page.getByRole('heading', { name: 'Itinerary' }).locator('xpath=ancestor::section[1]');
    await expect(itinerary.getByText('Pickup', { exact: true })).toBeVisible();
    await expect(itinerary.getByText('Drop-off', { exact: true })).not.toBeVisible();
  });

  test('Day by Day section appears for trips with start and end dates', async ({ page }) => {
    const tripName = uniqueName('E2E DayByDay Visible');
    const startAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const endAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

    // Create via UI then add dates via API so section appears
    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);
    await page.request.patch(`/api/travel/trips/${tripId}`, {
      data: { start_at: startAt.toISOString(), end_at: endAt.toISOString() },
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('button', { name: new RegExp(tripName) })
      .first()
      .click();

    await expect(page.getByRole('heading', { name: 'Day by Day' })).toBeVisible();
  });

  test('Day by Day add, edit and delete a day note', async ({ page }) => {
    const tripName = uniqueName('E2E DayByDay CRUD');
    const startAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 1000 * 60);
    const endAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 1000 * 60);

    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);
    await page.request.patch(`/api/travel/trips/${tripId}`, {
      data: { start_at: startAt.toISOString(), end_at: endAt.toISOString() },
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('button', { name: new RegExp(tripName) })
      .first()
      .click();

    const dayByDay = page.getByRole('heading', { name: 'Day by Day' }).locator('xpath=ancestor::section[1]');
    await expect(dayByDay).toBeVisible();

    // Click the first "+ Add notes" button
    await dayByDay.getByRole('button', { name: '+ Add notes' }).first().click();

    // Fill in title and notes
    await dayByDay.locator('input[placeholder="Day title (optional)"]').fill('Arrival day');
    await dayByDay.locator('textarea').fill('Pick up rental car, check in.');
    await dayByDay.getByRole('button', { name: 'Save', exact: true }).first().click();

    // Verify saved content appears
    await expect(dayByDay.getByText('Arrival day')).toBeVisible();
    await expect(dayByDay.getByText('Pick up rental car, check in.')).toBeVisible();

    // Edit the note
    await dayByDay.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await dayByDay.locator('input[placeholder="Day title (optional)"]').fill('Travel day');
    await dayByDay.getByRole('button', { name: 'Save', exact: true }).first().click();

    await expect(dayByDay.getByText('Travel day')).toBeVisible();
    await expect(dayByDay.getByText('Arrival day')).not.toBeVisible();

    // Delete the note
    await dayByDay.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await dayByDay.getByRole('button', { name: 'Delete', exact: true }).first().click();

    // Title should be gone; placeholder should return
    await expect(dayByDay.getByText('Travel day')).not.toBeVisible();
    await expect(dayByDay.getByRole('button', { name: '+ Add notes' }).first()).toBeVisible();
  });

  test('editing flight booking preserves all flight detail fields', async ({ page }) => {
    const tripName = uniqueName('E2E Edit Flight Trip');
    const flightBookingTitle = uniqueName('Edit Flight Booking');
    const updatedFlightNumber = 'BA2491';
    const updatedSeat = '15B';

    await createTrip(page, tripName);
    const tripButton = page.getByRole('button', { name: new RegExp(tripName) });
    await tripButton.click();

    // Add a flight booking
    await page.getByPlaceholder('Reservation title').fill(flightBookingTitle);
    const bookingTypeSelect = page.locator('select').first();
    await bookingTypeSelect.selectOption('flight');
    await page.getByPlaceholder('Flight no. (e.g. BA2490)').fill('BA2490');
    await page.getByPlaceholder('Seat (e.g. 14A)').fill('14A');
    await page.getByPlaceholder('From IATA (e.g. LHR)').fill('LHR');
    await page.getByPlaceholder('To IATA (e.g. CDG)').fill('CDG');
    await page.getByRole('button', { name: 'Add Reservation' }).click();

    await expect(page.locator('p.font-medium', { hasText: flightBookingTitle })).toBeVisible();

    // Click Edit button
    const bookingRow = reservationRowLocator(page, flightBookingTitle);
    await expect(bookingRow).toBeVisible();
    await bookingRow.getByRole('button', { name: 'Edit reservation' }).click();
    const editingBookingRow = page.getByTestId('booking-row').first();

    // Update flight details
    const flightNumberInput = editingBookingRow.getByPlaceholder('Flight no. (e.g. BA2490)');
    await flightNumberInput.fill(updatedFlightNumber);
    const seatInput = editingBookingRow.getByPlaceholder('Seat (e.g. 14A)');
    await seatInput.fill(updatedSeat);

    // Save
    await editingBookingRow.getByRole('button', { name: 'Save', exact: true }).click();

    // Updated flight details render in the expanded details panel.
    const updatedBookingRow = reservationRowLocator(page, flightBookingTitle);
    await expect(updatedBookingRow).toBeVisible();
    await updatedBookingRow.click();

    // Verify updated details are displayed.
    await expect(page.getByText(new RegExp(updatedFlightNumber, 'i'))).toBeVisible();
    await expect(page.getByText(new RegExp(`Seat ${updatedSeat}`, 'i'))).toBeVisible();
  });
});
