import { test, expect } from '@playwright/test';
import { SHARED_TRIP_FIXTURE } from '../constants';
import {
  uniqueName,
  ensureUserExists,
  createTrip,
  selectTrip,
  getTripIdByName,
  modal,
  modalDesktop,
} from './travel-helpers';

function sharingCard(page: import('@playwright/test').Page) {
  return page
    .getByRole('heading', { name: 'Sharing' })
    .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

test.describe('Travel – Sharing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel/sharing');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Sharing lifecycle on an owned trip: share with another user via the modal,
   * then revoke access.
   */
  test('share trip with a user and revoke access', async ({ page }) => {
    const tripName = uniqueName('E2E Sharing Trip');
    // `e2e-mcp@test.local` is one of the few addresses in ALLOWED_EMAILS for local
    // registration — it may already exist as a fixture seeded by the MCP-server e2e
    // setup (with its own display name), so look up the stored name dynamically
    // below rather than asserting a hardcoded one.
    const sharedEmail = 'e2e-mcp@test.local';

    await ensureUserExists(page, sharedEmail, 'E2eMcpPass123!', 'E2E MCP User');
    await createTrip(page, tripName);
    const tripId = await getTripIdByName(page, tripName);

    const card = sharingCard(page);
    await expect(card).toBeVisible();
    await expect(card.getByText('Not shared with anyone yet.')).toBeVisible();

    // ── Share ──────────────────────────────────────────────────────────────────
    await card.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = modal(page);
    await expect(modalDesktop(page).getByText('Share Trip', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('user@example.com').fill(sharedEmail);

    const shareResponsePromise = page.waitForResponse(
      res =>
        res.url().includes('/api/travel/trips/') && res.url().includes('/shares') && res.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Share', exact: true }).click();
    const shareResponse = await shareResponsePromise;
    expect(shareResponse.status()).toBe(201);

    // The fixture account may already exist with a display name set by another
    // package's E2E setup — look up the actual stored name rather than asserting
    // a hardcoded one.
    const sharesRes = await page.request.get(`/api/travel/trips/${tripId}/shares`);
    const sharesData = (await sharesRes.json()) as { shares: Array<{ email: string; name: string | null }> };
    const sharedDisplayName = sharesData.shares.find(s => s.email === sharedEmail)?.name ?? sharedEmail;
    await expect(dialog.getByText(sharedDisplayName)).toBeVisible();

    // ── Revoke ─────────────────────────────────────────────────────────────────
    const revokeResponsePromise = page.waitForResponse(
      res =>
        res.url().includes('/api/travel/trips/') &&
        res.url().includes('/shares/') &&
        res.request().method() === 'DELETE',
    );
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
    const revokeResponse = await revokeResponsePromise;
    expect(revokeResponse.status()).toBe(200);
    await expect(dialog.getByText(sharedDisplayName)).not.toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(card.getByText('Not shared with anyone yet.')).toBeVisible();
  });

  /**
   * Shared trip read-only view: uses the seeded SHARED_TRIP_FIXTURE trip — the
   * viewer sees the read-only sharing message and cannot add reservations.
   * Kept separate: relies on seeded fixture data and a different ownership context.
   */
  test('shows a seeded shared trip in read-only mode for the viewer', async ({ page }) => {
    await selectTrip(page, SHARED_TRIP_FIXTURE.tripName);

    const card = sharingCard(page);
    await expect(card).toBeVisible();
    await expect(card.getByText('Only the trip owner can manage sharing.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Share', exact: true })).not.toBeVisible();

    await page.goto('/travel/bookings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: '+ Add', exact: true })).not.toBeVisible();
    await expect(
      page.locator('[data-testid="booking-row"]').filter({ hasText: SHARED_TRIP_FIXTURE.bookingTitle }),
    ).toBeVisible();
  });
});
