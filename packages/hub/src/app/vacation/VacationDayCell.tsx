'use client';

import type { MonthGridDay, VacationCalendarRow } from '@my-hub/shared/utils';
import { cn } from '@/lib/utils';
import { deltaTextClass, formatDeltaCompact } from './vacation.utils';

type VacationDayCellProps = {
  day: MonthGridDay;
  row: VacationCalendarRow | undefined;
  isToday: boolean;
  selected: boolean;
};

/** One day of the vacation grid: date, the net delta of taking it off, and its markers. */
export function VacationDayCell({ day, row, isToday, selected }: VacationDayCellProps) {
  const [, delta = 0, , cost = 0, markers = []] = row ?? [];
  const holiday = markers.includes('holiday');
  const taken = markers.includes('leave_taken');
  const planned = markers.includes('leave_planned');

  return (
    <div
      data-date={day.date}
      className={cn(
        'relative flex h-11 select-none flex-col justify-between rounded-md border border-[var(--border)] px-1 py-0.5 text-left sm:h-12',
        !day.inMonth && 'opacity-40',
        // Leave is outlined outside the cell, against the page background.
        (taken || planned) && 'outline outline-2 outline-offset-1',
        taken && 'outline-[var(--violet)]',
        planned && 'outline-dashed outline-[var(--blue)]',
        selected && 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]',
      )}
    >
      <span className={cn('text-[10px] leading-none', isToday ? 'font-bold underline' : 'opacity-75')}>
        {Number(day.date.slice(8))}
        {holiday && <span className="ml-1 text-[var(--amber)]">●</span>}
      </span>
      {(taken || planned) && (
        <span
          aria-label={taken ? 'Leave taken' : 'Leave planned'}
          className={cn(
            'absolute right-0.5 top-0.5 rounded-sm px-0.5 text-[9px] font-bold leading-tight text-[var(--bg)]',
            taken ? 'bg-[var(--violet)]' : 'bg-[var(--blue)]',
          )}
        >
          {taken ? 'OFF' : 'PLAN'}
        </span>
      )}
      {row && (
        <span className={cn('text-right text-[11px] font-semibold tabular-nums sm:text-xs', deltaTextClass(delta))}>
          {cost === 0 && delta === 0 ? '—' : formatDeltaCompact(delta)}
        </span>
      )}
    </div>
  );
}
