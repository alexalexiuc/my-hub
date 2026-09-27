'use client';

import { useRef } from 'react';
import { dayNamesShort } from '@my-hub/shared/constants';
import type { MonthGridDay, VacationCalendarRow } from '@my-hub/shared/utils';
import { VacationDayCell } from './VacationDayCell';
import { isInRange } from './vacation.utils';

type VacationMonthGridProps = {
  days: MonthGridDay[];
  rows: Map<string, VacationCalendarRow>;
  today: string;
  selection: [string, string] | null;
  onSelect: (anchor: string, end: string) => void;
};

function dateAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-date]');
  return el?.dataset.date ?? null;
}

/**
 * Month grid of leave values. Tap a day to select it; press and drag across days to select a span.
 * Pointer position is resolved with elementFromPoint because touch pointers stay captured by the
 * element the drag started on.
 */
export function VacationMonthGrid({ days, rows, today, selection, onSelect }: VacationMonthGridProps) {
  const anchor = useRef<string | null>(null);
  const maxAbs = Math.max(0, ...[...rows.values()].map(r => Math.abs(r[1])));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] uppercase tracking-wide text-[var(--subtle)]">
        {dayNamesShort.map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div
        className="grid touch-none grid-cols-7 gap-1"
        onPointerDown={e => {
          const date = dateAt(e.clientX, e.clientY);
          if (!date) return;
          anchor.current = date;
          onSelect(date, date);
        }}
        onPointerMove={e => {
          if (!anchor.current) return;
          const date = dateAt(e.clientX, e.clientY);
          if (date) onSelect(anchor.current, date);
        }}
        onPointerUp={() => {
          anchor.current = null;
        }}
        onPointerCancel={() => {
          anchor.current = null;
        }}
      >
        {days.map(day => (
          <VacationDayCell
            key={day.date}
            day={day}
            row={rows.get(day.date)}
            maxAbs={maxAbs}
            isToday={day.date === today}
            selected={isInRange(day.date, selection)}
          />
        ))}
      </div>
    </div>
  );
}
