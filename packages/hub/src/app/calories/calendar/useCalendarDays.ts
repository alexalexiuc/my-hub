'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { CalendarResponseSchema } from '@/app/api/calories/calendar/calendar.schemas';
import { mealEvents } from '../mealEvents';
import type { CalendarDay } from './types';

/** Either a whole month or an explicit range, as `GET /api/calories/calendar` accepts. */
export type CalendarRange = { month: string } | { dateFrom: string; dateTo: string };

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
      apiFetch('/api/calories/calendar', {
        query: { month, dateFrom, dateTo },
        responseSchema: CalendarResponseSchema,
        silentToast: true,
      })
        .then(data => {
          if (!cancelled) setDays(data.days);
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
