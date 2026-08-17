'use client';

import { DaysOfWeekValues, DAY_LABELS_SHORT } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { cn } from '@/lib/utils';

type DayJumpChipsProps = {
  /** Planned meal count per day — drives the badge and the "nothing here" dimming. */
  mealCounts: Record<DayOfWeek, number>;
  todayIndex: DayOfWeek | undefined;
  onJump: (day: DayOfWeek) => void;
};

/**
 * Phone-only shortcut row. The stacked day list is seven cards tall, so reaching Friday means
 * scrolling past everything before it; these jump straight there. Not rendered on desktop, where
 * the grid already shows the whole week at once.
 */
export function DayJumpChips({ mealCounts, todayIndex, onJump }: DayJumpChipsProps) {
  // Equal-width, never scrolling: all seven have to be reachable in one tap, or the row is just
  // another thing to scroll past. The meal count sits under the label rather than beside it,
  // since side-by-side would not fit seven chips across a phone.
  //
  // Deliberately no `data-layout="mobile"`: that attribute marks one half of a desktop/mobile
  // pair, and this row has no desktop counterpart — Modal already uses it, so a shared selector
  // would match both. Tests target the chips by their "Jump to …" labels.
  return (
    <div className="flex gap-1 md:hidden">
      {DaysOfWeekValues.map(day => {
        const count = mealCounts[day];
        const isToday = day === todayIndex;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onJump(day)}
            aria-label={`Jump to ${DAY_LABELS_SHORT[day]}`}
            className={cn(
              'flex flex-1 flex-col items-center rounded-lg border px-0.5 py-1 text-[11px] font-medium leading-tight transition-colors',
              isToday
                ? 'border-green-500/60 bg-green-500/10 text-green-400'
                : count > 0
                  ? 'border-[var(--border)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--muted)]',
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
