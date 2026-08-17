'use client';

import { cn } from '@/lib/utils';
import { intakeBarColor } from '../calories.utils';
import type { CalendarDay } from './types';
import type { MonthGridDay } from './calendar.utils';

type DayCellProps = {
  day: MonthGridDay;
  summary?: CalendarDay;
  isToday: boolean;
  onSelect: (date: string) => void;
};

/**
 * One month-grid cell: the day number and, once meals are logged, the kcal total tinted by the
 * same red/amber/green adherence rule the weekly menu and progress bars use — a day reads the
 * same way whichever tab it's judged from.
 */
export function DayCell({ day, summary, isToday, onSelect }: DayCellProps) {
  const kcal = summary?.kcal ?? 0;
  const hasData = (summary?.mealCount ?? 0) > 0;
  const color = intakeBarColor(kcal, summary?.min ?? null, summary?.target ?? null);
  const dayNum = Number(day.date.slice(-2));

  return (
    <button
      type="button"
      onClick={() => onSelect(day.date)}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-center transition-colors',
        day.inMonth ? 'border-[var(--border)] bg-[var(--card2)]' : 'border-transparent bg-transparent opacity-40',
        isToday && 'border-[var(--accent)]',
        'hover:border-[var(--accent)]/60',
      )}
      style={
        day.inMonth && hasData
          ? { backgroundColor: `color-mix(in srgb, ${color} 16%, var(--card2))`, borderColor: color }
          : undefined
      }
    >
      <span className={cn('text-[10px]', day.inMonth ? 'text-[var(--muted)]' : 'text-[var(--subtle)]')}>{dayNum}</span>
      {day.inMonth && hasData && (
        <span className="text-[11px] font-semibold" style={{ color }}>
          {Math.round(kcal)}
        </span>
      )}
    </button>
  );
}
