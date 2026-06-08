import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Format a Date for a datetime-local input value (local time, no seconds). */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export async function ensureUserExists(page: Page, email: string, password: string, name: string) {
  const res = await page.request.post('/api/auth/register', {
    data: { email, password, name },
  });
  expect([201, 409]).toContain(res.status());
}

/** Locator for the currently-open modal shell (Modal component has no role="dialog"). */
export function modal(page: Page): Locator {
  return page.locator('.modal-shell');
}

/** Locator for the desktop variant of the active modal footer/content. */
export function modalDesktop(page: Page): Locator {
  return modal(page).locator('[data-layout="desktop"]');
}

/**
 * Locator for the desktop modal *title* only (Modal renders both a desktop title
 * container `[data-layout="desktop"].mb-4` and a desktop footer container
 * `[data-layout="desktop"].mt-4` — `modalDesktop` matches both, so a title that
 * shares text with a submit button, e.g. "Add Reservation", is ambiguous there).
 */
export function modalTitle(page: Page): Locator {
  return modal(page).locator('[data-layout="desktop"].mb-4');
}

/** Opens the TripSwitcher dropdown (the trip selector button at the top of every Travel tab). */
export async function openTripSwitcher(page: Page): Promise<Locator> {
  const dropdown = page.locator('div.relative.mb-5');
  const isOpen = await dropdown
    .locator('text=+ New Trip')
    .isVisible()
    .catch(() => false);
  if (!isOpen) {
    await dropdown.locator('> button').first().click();
  }
  await expect(dropdown.getByText('+ New Trip')).toBeVisible();
  return dropdown;
}

/** Creates a trip via the TripModal (TripSwitcher → "+ New Trip") and waits for it to become active. */
export async function createTrip(page: Page, tripName: string, destination = 'Rome'): Promise<void> {
  const dropdown = await openTripSwitcher(page);
  await dropdown.getByText('+ New Trip').click();

  const dialog = modal(page);
  await expect(modalDesktop(page).getByText('New Trip', { exact: true })).toBeVisible();
  await dialog.getByPlaceholder('e.g. Tokyo 2026').fill(tripName);
  await dialog.getByPlaceholder('e.g. Tokyo, Japan').fill(destination);
  await dialog.getByRole('button', { name: 'Create Trip', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await expect(page.locator('div.relative.mb-5 > button').first()).toContainText(tripName);
}

/** Selects a trip by name from the TripSwitcher dropdown (persists activeTripId in localStorage). */
export async function selectTrip(page: Page, tripName: string): Promise<void> {
  const dropdown = await openTripSwitcher(page);
  await dropdown
    .getByRole('button', { name: new RegExp(tripName) })
    .first()
    .click();
  await expect(page.locator('div.relative.mb-5 > button').first()).toContainText(tripName);
}

export async function getTripIdByName(page: Page, tripName: string): Promise<number> {
  const res = await page.request.get('/api/travel/trips');
  expect(res.ok()).toBeTruthy();
  const data = (await res.json()) as { trips: Array<{ id: number; name: string }> };
  const trip = data.trips.find(t => t.name === tripName);
  expect(trip).toBeTruthy();
  return trip!.id;
}
