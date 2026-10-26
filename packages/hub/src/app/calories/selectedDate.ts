import { useSyncExternalStore } from 'react';

/**
 * The day the Today page is showing, shared with the layout's "Add meal" buttons. Those live in
 * the sidebar and bottom nav, outside the page, and always logged to the real today — so a meal
 * forgotten yesterday could not be added from yesterday's view. `null` while no page has a day
 * selected; callers then fall back to today.
 */
let selectedDate: string | null = null;
const listeners = new Set<() => void>();

/** Sets (or clears, with `null`) the day the layout's Add meal buttons log to. */
export function setCaloriesSelectedDate(date: string | null) {
  if (date === selectedDate) return;
  selectedDate = date;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The day the Today page is showing, or null when it isn't mounted. */
export function useCaloriesSelectedDate(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => selectedDate,
    () => null,
  );
}
