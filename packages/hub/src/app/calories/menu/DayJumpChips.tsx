'use client';

import { DaysOfWeekValues, DAY_LABELS_SHORT } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { DumbbellIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { planStatusLabel } from './menu.utils';
import type { DayPlan } from './menu.utils';

type DayJumpChipsProps = {
  /** Each day's plan — drives the gym mark, the status dot and the "nothing planned" dimming. */
  plans: Record<DayOfWeek, DayPlan>;
  todayIndex: DayOfWeek | undefined;
  /** The day currently shown by `MobileDayView` — gets a ring. */
  selectedDay: DayOfWeek;
  onSelect: (day: DayOfWeek) => void;
};

/**
 * Phone-only day selector. `MobileDayView` shows one day at a time; these chips pick which one,
 * and each also reads as a week overview: a dumbbell on training days and a dot coloured by
 * whether that day's plan sits in its range.
 */
export function DayJumpChips({ plans, todayIndex, selectedDay, onSelect }: DayJumpChipsProps) {
  // Equal-width, never scrolling: all seven have to be reachable in one tap, or the row is just
  // another thing to scroll past.
  //
  // No `md:hidden` of its own: this component only ever renders inside `MobileDayView`, which is
  // already wrapped in a `data-layout="mobile"` / `md:hidden` container by its caller.
  return (
    <div className="flex gap-1">
      {DaysOfWeekValues.map(day => {
        const plan = plans[day];
        const count = plan.mealCount;
        const isToday = day === todayIndex;
        const isSelected = day === selectedDay;
        const status = planStatusLabel(plan);
        const label = [
          `Jump to ${DAY_LABELS_SHORT[day]}`,
          plan.kind === 'gym' ? 'gym day' : null,
          count > 0 ? `${count} meals` : 'no meals',
          status,
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-label={label}
            aria-current={isSelected ? 'true' : undefined}
            className={cn(
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg border px-0.5 py-1.5 text-xs font-semibold leading-tight transition-colors',
              isToday
                ? 'border-[var(--green)] bg-[var(--green-d)] text-[var(--green)]'
                : count > 0
                  ? 'border-[var(--border)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--muted)]',
              isSelected && 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]',
            )}
          >
            {DAY_LABELS_SHORT[day]}
            <span className="flex h-3 items-center gap-1" aria-hidden="true">
              {plan.kind === 'gym' && <DumbbellIcon className="size-3 text-[var(--accent)]" />}
              {count > 0 && <span className="size-1.5 rounded-full" style={{ backgroundColor: plan.color }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
