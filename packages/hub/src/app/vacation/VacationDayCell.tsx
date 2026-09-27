'use client';

import type { MonthGridDay, VacationCalendarRow } from '@my-hub/shared/utils';
import { cn } from '@/lib/utils';
import { deltaFill, formatDeltaCompact } from './vacation.utils';

type VacationDayCellProps = {
  day: MonthGridDay;
  row: VacationCalendarRow | undefined;
  maxAbs: number;
  isToday: boolean;
  selected: boolean;
};

/** One day of the vacation grid: date, the net delta of taking it off, and its markers. */
export function VacationDayCell({ day, row, maxAbs, isToday, selected }: VacationDayCellProps) {
  const [, delta = 0, , cost = 0, markers = []] = row ?? [];
  const holiday = markers.includes('holiday');
  const taken = markers.includes('leave_taken');
  const planned = markers.includes('leave_planned');
  const fill = deltaFill(delta, maxAbs);

  return (
    <div
      data-date={day.date}
      className={cn(
        'relative flex h-11 select-none flex-col justify-between rounded-md border border-[var(--border)] px-1 py-0.5 text-left sm:h-12',
        fill?.strong && 'border-transparent text-[var(--bg)]',
        !day.inMonth && 'opacity-40',
        taken && 'border-[var(--violet)]',
        planned && 'border-dashed border-[var(--blue)]',
        selected && 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]',
      )}
      style={{ backgroundColor: fill?.background }}
    >
      <span className={cn('text-[10px] leading-none', isToday ? 'font-bold underline' : 'opacity-75')}>
        {Number(day.date.slice(8))}
        {holiday && <span className="ml-1 text-[var(--amber)]">●</span>}
      </span>
      {row && (
        <span className="text-right text-[11px] font-semibold tabular-nums sm:text-xs">
          {cost === 0 && delta === 0 ? '—' : formatDeltaCompact(delta)}
        </span>
      )}
    </div>
  );
}
