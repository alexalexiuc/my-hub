'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import { mealEvents } from './mealEvents';
import { loadErrorMessage } from './useCalorieProfile';

/**
 * The meals logged on `date`, reloaded quietly on every meal change anywhere (`mealEvents`).
 *
 * `meals` is null until `date`'s meals arrive — after a date change too, so the previous day's
 * list is never shown (or offered "Copy meals from yesterday") as if it were the new day's.
 * `error` is set when `date` never loaded; a failed reload keeps the list already shown.
 */
export function useMealsForDate(date: string) {
  const [loaded, setLoaded] = useState<{ date: string; meals: MealLog[] } | null>(null);
  const [failed, setFailed] = useState<{ date: string; error: string } | null>(null);
  const dateRef = useRef(date);
  dateRef.current = date;
  // Only the latest request may land: two quick reloads of the same day (deleting two meals in a row)
  // can answer out of order, and the older answer would bring the first deleted meal back.
  const latestRequest = useRef(0);

  const load = useCallback(async (forDate: string, background: boolean) => {
    const request = ++latestRequest.current;
    const isCurrent = () => request === latestRequest.current && dateRef.current === forDate;
    try {
      const data = await apiFetch<{ meals: MealLog[] }>('/api/calories/meals', {
        query: { date: forDate, limit: 100 },
        silentToast: background,
      });
      if (!isCurrent()) return;
      setLoaded({ date: forDate, meals: data.meals });
      setFailed(null);
    } catch (e) {
      if (isCurrent()) setFailed({ date: forDate, error: loadErrorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void load(date, false);
  }, [date, load]);

  useEffect(() => {
    const handler = () => void load(dateRef.current, true);
    mealEvents.on('changed', handler);
    return () => mealEvents.off('changed', handler);
  }, [load]);

  return {
    meals: loaded?.date === date ? loaded.meals : null,
    error: failed?.date === date && loaded?.date !== date ? failed.error : null,
  };
}
