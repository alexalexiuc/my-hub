'use client';

import { DAY_LABELS_SHORT, DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { DumbbellIcon } from '@/components/icons';

export interface CreateMenuDayTabsProps {
  activeDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  mealCountPerDay: Record<DayOfWeek, number>;
  dayDates: Record<DayOfWeek, string>;
  today: string;
  gymDays: number[];
}

/** Day-of-week tab strip for the create-menu modal — past days (before today) are disabled. */
export function CreateMenuDayTabs({
  activeDay,
  onSelectDay,
  mealCountPerDay,
  dayDates,
  today,
  gymDays,
}: CreateMenuDayTabsProps) {
  return (
    <>
      {/* Day tabs — past days disabled on current week */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {DaysOfWeekValues.map(d => {
          const count = mealCountPerDay[d];
          const isActive = d === activeDay;
          const isPast = dayDates[d] < today;
          const isGymDay = gymDays.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => !isPast && onSelectDay(d)}
              disabled={isPast}
              className={`relative shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--text)]'
              }`}
            >
              {DAY_LABELS_SHORT[d]}
              {isGymDay && <DumbbellIcon className="inline-block ml-0.5 size-3 text-[var(--accent)]" title="Gym day" />}
              {count > 0 && (
                <span
                  className={`ml-1 rounded-full px-1 text-[10px] font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {gymDays.length > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
          <DumbbellIcon className="size-3 text-[var(--accent)]" /> Days marked with this icon are your gym days
        </p>
      )}
    </>
  );
}
