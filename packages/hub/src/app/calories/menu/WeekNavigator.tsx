'use client';

import { IconButton } from '@/components';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon } from '@/components/icons';
import { closestMenu, formatWeekLabel } from './menu.utils';
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
    <div className="flex items-center gap-2">
      <IconButton
        label="Previous week"
        icon={<ChevronLeftOutlineIcon />}
        onClick={() => prevMenu && onSelect(prevMenu)}
        disabled={!prevMenu}
        className="rounded-lg border border-[var(--border)] bg-[var(--card2)] text-[var(--text)] hover:bg-[var(--card)]"
      />

      {/* data-week-start lets tests assert the selected week without re-deriving the label format */}
      <span
        data-week-start={selectedMenu?.weekStart}
        className="text-sm font-medium text-[var(--text)] min-w-[160px] text-center"
      >
        {selectedMenu ? formatWeekLabel(selectedMenu.weekStart) : '—'}
      </span>

      <IconButton
        label="Next week"
        icon={<ChevronRightOutlineIcon />}
        onClick={() => nextMenu && onSelect(nextMenu)}
        disabled={!nextMenu}
        className="rounded-lg border border-[var(--border)] bg-[var(--card2)] text-[var(--text)] hover:bg-[var(--card)]"
      />

      <span className="text-xs text-[var(--subtle)] ml-1">
        {position} / {menus.length}
      </span>
    </div>
  );
}
