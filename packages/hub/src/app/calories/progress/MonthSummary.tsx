'use client';

import type { CalorieProfile } from '@my-hub/shared/types';
import { dateToString, summariseTargetAdherence } from '@my-hub/shared/utils';
import { currentMonthStr } from '../calendar/calendar.utils';
import { useCalendarDays } from '../calendar/useCalendarDays';
import { AdherenceTiles } from './AdherenceTiles';

type MonthSummaryProps = {
  profile: CalorieProfile | null;
};

/**
 * This month against the daily target as four tiles. Earlier months are paged inside the month
 * calendar modal; the page itself always answers "how is this month going".
 */
export function MonthSummary({ profile }: MonthSummaryProps) {
  const { days } = useCalendarDays({ month: currentMonthStr() });
  const monthDays = days ?? [];

  const summary = summariseTargetAdherence(monthDays, dateToString(new Date()), profile?.goalProtein ?? null);
  const baseTarget = monthDays.find(d => !d.isGymDay && d.target !== null)?.target ?? null;

  return <AdherenceTiles summary={summary} baseTarget={baseTarget} />;
}
