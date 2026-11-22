'use client';

import { NavRow } from '@/components';
import { formatWeekRangeStr, shiftWeekStr } from '@my-hub/shared/utils';
import { weekNavBounds } from './menu.utils';
import type { WeeklyMenuSummary } from './types';

type WeekNavigatorProps = {
  menus: WeeklyMenuSummary[];
  /** Monday (YYYY-MM-DD) of the week on screen — with or without a menu. */
  selectedWeek: string;
  currentWeekStart: string;
  onSelectWeek: (weekStart: string) => void;
};

/**
 * Pages through calendar weeks, one at a time, within `weekNavBounds`. The counter shows the
 * week's place among saved menus when it has one, and is left out for an empty week.
 */
export function WeekNavigator({ menus, selectedWeek, currentWeekStart, onSelectWeek }: WeekNavigatorProps) {
  const { min, max } = weekNavBounds(menus, currentWeekStart);
  const hasMenu = menus.some(m => m.weekStart === selectedWeek);
  const position = menus.filter(m => m.weekStart <= selectedWeek).length;

  return (
    <NavRow
      prevLabel="Previous week"
      nextLabel="Next week"
      onPrev={() => onSelectWeek(shiftWeekStr(selectedWeek, -1))}
      onNext={() => onSelectWeek(shiftWeekStr(selectedWeek, 1))}
      prevDisabled={selectedWeek <= min}
      nextDisabled={selectedWeek >= max}
      label={
        // data-week-start lets tests assert the selected week without re-deriving the label format
        <span
          data-week-start={selectedWeek}
          className="text-sm font-medium text-[var(--text)] min-w-[160px] text-center"
        >
          {formatWeekRangeStr(selectedWeek)}
        </span>
      }
      trailing={
        <span className="text-xs text-[var(--muted)] ml-1">
          {hasMenu ? `${position} / ${menus.length}` : 'No menu'}
        </span>
      }
    />
  );
}
