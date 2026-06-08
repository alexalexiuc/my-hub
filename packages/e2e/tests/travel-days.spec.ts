import { test, expect } from '@playwright/test';
import { uniqueName, createTrip, getTripIdByName } from './travel-helpers';

test.describe('Travel – Days', () => {
  /**
   * `/travel/days` renders the same `DayByDay` section as the Itinerary tab
   * (full note add/edit/delete CRUD is covered there — see travel-itinerary.spec.ts).
   * This is a route-level smoke test confirming the dedicated Days page renders it
   * for the active trip — `DayByDay` only renders once the trip has start/end dates.
   */
  test('shows the Day by Day section for the active trip', async ({ page }) => {
    const tripName = uniqueName('E2E Days Trip');
    const now = new Date();
    const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const endAt = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    await page.goto('/travel');
    await page.waitForLoadState('networkidle');
    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);
    await page.request.patch(`/api/travel/trips/${tripId}`, {
      data: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    });

    await page.goto('/travel/days');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Day by Day' })).toBeVisible();
  });
});
