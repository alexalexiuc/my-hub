'use client';

import { DaysOfWeekValues, DAY_LABELS_SHORT } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { cn } from '@/lib/utils';

type DayJumpChipsProps = {
  /** Planned meal count per day — drives the badge and the "nothing here" dimming. */
  mealCounts: Record<DayOfWeek, number>;
  todayIndex: DayOfWeek | undefined;
  /** The day currently shown by `MobileDayView` — gets a ring so the chip row stays in sync with the arrows. */
  selectedDay: DayOfWeek;
  onSelect: (day: DayOfWeek) => void;
};

/**
 * Phone-only day selector. `MobileDayView` shows one day at a time; these chips pick which one,
 * alongside the prev/next-day arrows above them.
 */
export function DayJumpChips({ mealCounts, todayIndex, selectedDay, onSelect }: DayJumpChipsProps) {
  // Equal-width, never scrolling: all seven have to be reachable in one tap, or the row is just
  // another thing to scroll past. The meal count sits under the label rather than beside it,
  // since side-by-side would not fit seven chips across a phone.
  //
  // No `md:hidden` of its own: this component only ever renders inside `MobileDayView`, which is
  // already wrapped in a `data-layout="mobile"` / `md:hidden` container by its caller.
  return (
    <div className="flex gap-1">
      {DaysOfWeekValues.map(day => {
        const count = mealCounts[day];
        const isToday = day === todayIndex;
        const isSelected = day === selectedDay;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-label={`Jump to ${DAY_LABELS_SHORT[day]}`}
            aria-current={isSelected ? 'true' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center rounded-lg border px-0.5 py-1 text-[11px] font-medium leading-tight transition-colors',
              isToday
                ? 'border-green-500/60 bg-green-500/10 text-green-400'
                : count > 0
                  ? 'border-[var(--border)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--muted)]',
              isSelected && 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]',
            )}
          >
            {DAY_LABELS_SHORT[day]}
            <span className={cn('text-[10px] font-semibold', count > 0 ? 'text-[var(--accent)]' : 'opacity-0')}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
