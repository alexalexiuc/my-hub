import { test, expect } from '@playwright/test';
import { uniqueName, createTrip, getTripIdByName } from './travel-helpers';

test.describe('Travel – Map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel/map');
    await page.waitForLoadState('networkidle');
  });

  /**
   * The map renders once a trip has at least two geolocated reservations.
   * Bookings are seeded via the API (lat/lng are not exposed in the BookingModal UI).
   */
  test('shows the trip map once geolocated reservations exist', async ({ page }) => {
    const tripName = uniqueName('E2E Map Trip');

    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);

    const geoRes1 = await page.request.post('/api/travel/bookings', {
      data: { tripId, title: 'Paris Hotel', bookingType: 'accommodation', lat: 48.8566, lng: 2.3522 },
    });
    expect(geoRes1.status()).toBe(201);

    const geoRes2 = await page.request.post('/api/travel/bookings', {
      data: { tripId, title: 'Rome Hotel', bookingType: 'accommodation', lat: 41.9028, lng: 12.4964 },
    });
    expect(geoRes2.status()).toBe(201);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="trip-map-container"]')).toBeVisible({ timeout: 10_000 });
  });
});
