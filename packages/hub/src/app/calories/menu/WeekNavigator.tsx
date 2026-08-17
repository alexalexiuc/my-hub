'use client';

import { NavRow } from '@/components';
import { formatWeekRangeStr } from '@my-hub/shared/utils';
import { closestMenu } from './menu.utils';
import type { WeeklyMenuSummary } from './types';

type WeekNavigatorProps = {
  menus: WeeklyMenuSummary[];
  selectedMenu: WeeklyMenuSummary | null;
  onSelect: (menu: WeeklyMenuSummary) => void;
};

export function WeekNavigator({ menus, selectedMenu, onSelect }: WeekNavigatorProps) {
  // Order-independent navigation: compare weekStart values instead of array positions,
  // so a change in the service's sort order can never silently invert prev/next.
  const selectedWeek = selectedMenu?.weekStart;
  const prevMenu = selectedWeek ? closestMenu(menus, selectedWeek, -1) : null;
  const nextMenu = selectedWeek ? closestMenu(menus, selectedWeek, 1) : null;
  const position = selectedWeek ? menus.filter(m => m.weekStart <= selectedWeek).length : 0;

  return (
    <NavRow
      prevLabel="Previous week"
      nextLabel="Next week"
      onPrev={() => prevMenu && onSelect(prevMenu)}
      onNext={() => nextMenu && onSelect(nextMenu)}
      prevDisabled={!prevMenu}
      nextDisabled={!nextMenu}
      label={
        // data-week-start lets tests assert the selected week without re-deriving the label format
        <span
          data-week-start={selectedMenu?.weekStart}
          className="text-sm font-medium text-[var(--text)] min-w-[160px] text-center"
        >
          {selectedMenu ? formatWeekRangeStr(selectedMenu.weekStart) : '—'}
        </span>
      }
      trailing={
        <span className="text-xs text-[var(--subtle)] ml-1">
          {position} / {menus.length}
        </span>
      }
    />
  );
}
