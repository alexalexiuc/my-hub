'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card } from '@/components';
import { CalendarIcon } from '@/components/icons';
import { DayTargetStatuses, dayNamesShort } from '@my-hub/shared/constants';
import {
  dateToString,
  dayOfWeekMon0,
  dayTargetStatus,
  shiftDateStr,
  summariseTargetAdherence,
} from '@my-hub/shared/utils';
import { dayStatusColor } from './calories.utils';
import { STREAK_LOOKBACK_DAYS } from './constants';
import { useCalendarDays } from './calendar/useCalendarDays';

type LastSevenDaysProps = {
  /** Daily protein goal in grams, for the protein-hit count. */
  proteinGoalG: number | null;
  /**
   * On Progress the card opens the month calendar instead of linking to Progress: given, the
   * card ends in a "View month calendar" button and is no longer a link.
   */
  onOpenMonth?: () => void;
};

/**
 * The week so far as seven coloured dots plus the current streak — the daily habit signal on the
 * page you land on, linking through to the month on Progress. Today's dot stays neutral: the day
 * isn't over, and reading it as "under" at breakfast would be wrong.
 */
export function LastSevenDays({ proteinGoalG, onOpenMonth }: LastSevenDaysProps) {
  const today = dateToString(new Date());
  const { days } = useCalendarDays({ dateFrom: shiftDateStr(today, -(STREAK_LOOKBACK_DAYS - 1)), dateTo: today });

  if (!days) return null;

  const week = days.slice(-7);
  const summary = summariseTargetAdherence(days, today, proteinGoalG);
  const finishedWeek = week.filter(d => d.date < today && d.mealCount > 0);
  const onTargetThisWeek = finishedWeek.filter(d => dayTargetStatus(d) === DayTargetStatuses.OnTarget).length;
  const verdict =
    finishedWeek.length > 0
      ? `${onTargetThisWeek} of ${finishedWeek.length} logged days on target`
      : 'Log a few days to see how you track';

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Last 7 days</span>
        {summary.currentStreak > 0 && (
          <span className="text-xs font-semibold text-[var(--accent)]">{summary.currentStreak}-day streak</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.map(day => {
          const isToday = day.date === today;
          const color = dayStatusColor(dayTargetStatus(day));
          const label = dayNamesShort[dayOfWeekMon0(day.date)];
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <span
                title={`${label}: ${Math.round(day.kcal)} kcal`}
                className={cn(
                  'size-7 rounded-full border-[1.5px]',
                  isToday ? 'border-dashed border-[var(--muted)]' : 'border-solid',
                )}
                style={
                  isToday
                    ? undefined
                    : { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` }
                }
              />
              <span className={cn('text-[10px]', isToday ? 'font-bold text-[var(--accent)]' : 'text-[var(--subtle)]')}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );

  if (onOpenMonth) {
    return (
      <Card compact className="flex flex-col gap-3 p-4">
        {content}
        <p className="text-[11px] text-[var(--muted)]">{verdict}</p>
        {/* Hand-styled: an accent outline, which no Button variant offers. */}
        <button
          type="button"
          onClick={onOpenMonth}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-[var(--accent)] text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-d)]"
        >
          <CalendarIcon className="size-4" />
          View month calendar
        </button>
      </Card>
    );
  }

  return (
    <Link href="/calories/progress" className="block no-underline" aria-label="Last 7 days — open Progress">
      <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-[var(--accent)]">
        {content}
        <p className="text-[11px] text-[var(--muted)]">
          {verdict} · {finishedWeek.length > 0 ? 'see the month →' : 'open Progress →'}
        </p>
      </Card>
    </Link>
  );
}
