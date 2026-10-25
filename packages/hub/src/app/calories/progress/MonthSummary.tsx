'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import type { CalorieProfile } from '@my-hub/shared/types';
import { dateToString, summariseTargetAdherence } from '@my-hub/shared/utils';
import { CalendarResponseSchema } from '@/app/api/calories/calendar/calendar.schemas';
import { currentMonthStr } from '../calendar/calendar.utils';
import type { CalendarDay } from '../calendar/types';
import { mealEvents } from '../mealEvents';
import { AdherenceTiles } from './AdherenceTiles';

type MonthSummaryProps = {
  profile: CalorieProfile | null;
};

/**
 * This month against the daily target as four tiles. Earlier months are paged inside the month
 * calendar modal; the page itself always answers "how is this month going".
 */
export function MonthSummary({ profile }: MonthSummaryProps) {
  const month = currentMonthStr();
  const [days, setDays] = useState<CalendarDay[]>([]);

  const load = useCallback(() => {
    apiFetch('/api/calories/calendar', { query: { month }, responseSchema: CalendarResponseSchema, silentToast: true })
      .then(data => setDays(data.days))
      .catch(() => undefined);
  }, [month]);

  useEffect(() => {
    load();
    mealEvents.on('changed', load);
    return () => mealEvents.off('changed', load);
  }, [load]);

  const summary = summariseTargetAdherence(days, dateToString(new Date()), profile?.goalProtein ?? null);
  const baseTarget = days.find(d => !d.isGymDay && d.target !== null)?.target ?? null;

  return <AdherenceTiles summary={summary} baseTarget={baseTarget} isCurrentMonth />;
}
