'use client';

import { dayNamesShort } from '@my-hub/shared/constants';
import { DayCell } from './DayCell';
import type { CalendarDay } from './types';
import type { MonthGridDay } from './calendar.utils';

type MonthGridProps = {
  days: MonthGridDay[];
  summaries: Map<string, CalendarDay>;
  today: string;
  onSelectDay: (date: string) => void;
};

/**
 * The month calendar itself — a fixed 7-column grid, unchanged between mobile and desktop.
 * Cells just get narrower on a phone; there is no separate stacked/agenda layout to keep in sync.
 */
export function MonthGrid({ days, summaries, today, onSelectDay }: MonthGridProps) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] uppercase tracking-wide text-[var(--subtle)]">
        {dayNamesShort.map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => (
          <DayCell
            key={day.date}
            day={day}
            summary={summaries.get(day.date)}
            isToday={day.date === today}
            isPast={day.date < today}
            onSelect={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}
