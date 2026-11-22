'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { CalendarResponseSchema } from '@/app/api/calories/calendar/calendar.schemas';
import { mealEvents } from '../mealEvents';
import type { CalendarDay } from './types';

/** Either a whole month or an explicit range, as `GET /api/calories/calendar` accepts. */
export type CalendarRange = { month: string } | { dateFrom: string; dateTo: string };

// Hooks that ask for the same range at once (Today's day range and its seven-day strip, both
// refreshing on `changed`) share one request. Every `changed` starts a new generation, so a request
// already in flight from before a meal change is never reused for the refresh that follows it. This
// listener is registered at import, ahead of any hook's, so the bump lands first.
let generation = 0;
mealEvents.on('changed', () => {
  generation++;
});
const inFlight = new Map<string, Promise<CalendarDay[]>>();

function fetchCalendarDays(query: { month?: string; dateFrom?: string; dateTo?: string }): Promise<CalendarDay[]> {
  const key = `${generation}:${query.month}:${query.dateFrom}:${query.dateTo}`;
  let request = inFlight.get(key);
  if (!request) {
    request = apiFetch('/api/calories/calendar', { query, responseSchema: CalendarResponseSchema, silentToast: true })
      .then(data => data.days)
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
  }
  return request;
}

/**
 * Per-day totals and targets for a month or range, refetched whenever a meal changes anywhere
 * (`mealEvents`). `days` is null until the first response, so callers can tell "loading" from
 * "nothing logged"; a failed first load settles on an empty list rather than loading forever.
 */
export function useCalendarDays(range: CalendarRange): { days: CalendarDay[] | null } {
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const month = 'month' in range ? range.month : undefined;
  const dateFrom = 'dateFrom' in range ? range.dateFrom : undefined;
  const dateTo = 'dateTo' in range ? range.dateTo : undefined;

  useEffect(() => {
    // Set on range change or unmount, so a slow response for a range already left (paging
    // months quickly) can't land after the current one and overwrite it.
    let cancelled = false;
    const load = (isFirst: boolean) =>
      fetchCalendarDays({ month, dateFrom, dateTo })
        .then(loaded => {
          if (!cancelled) setDays(loaded);
        })
        .catch(() => {
          // A failed refresh keeps the totals already shown; a failed first load shows none.
          if (!cancelled && isFirst) setDays([]);
        });
    const refresh = () => void load(false);

    setDays(null);
    void load(true);
    mealEvents.on('changed', refresh);
    return () => {
      cancelled = true;
      mealEvents.off('changed', refresh);
    };
  }, [month, dateFrom, dateTo]);

  return { days };
}
