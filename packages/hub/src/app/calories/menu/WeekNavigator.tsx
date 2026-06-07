'use client';

import { IconButton } from '@/components';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon } from '@/components/icons';
import { formatWeekLabel } from './menu.utils';
import type { WeeklyMenuSummary } from './types';

type WeekNavigatorProps = {
  menus: WeeklyMenuSummary[];
  selectedMenu: WeeklyMenuSummary | null;
  onSelect: (menu: WeeklyMenuSummary) => void;
};

export function WeekNavigator({ menus, selectedMenu, onSelect }: WeekNavigatorProps) {
  const idx = menus.findIndex(m => m.menuId === selectedMenu?.menuId);
  const canPrev = idx < menus.length - 1;
  const canNext = idx > 0;

  return (
    <div className="flex items-center gap-2">
      <IconButton
        label="Previous week"
        icon={<ChevronLeftOutlineIcon />}
        onClick={() => canPrev && onSelect(menus[idx + 1]!)}
        disabled={!canPrev}
        className="rounded-lg border border-[var(--border)] bg-[var(--card2)] text-[var(--text)] hover:bg-[var(--card)]"
      />

      <span className="text-sm font-medium text-[var(--text)] min-w-[160px] text-center">
        {selectedMenu ? formatWeekLabel(selectedMenu.weekStart) : '—'}
      </span>

      <IconButton
        label="Next week"
        icon={<ChevronRightOutlineIcon />}
        onClick={() => canNext && onSelect(menus[idx - 1]!)}
        disabled={!canNext}
        className="rounded-lg border border-[var(--border)] bg-[var(--card2)] text-[var(--text)] hover:bg-[var(--card)]"
      />

      <span className="text-xs text-[var(--subtle)] ml-1">
        {idx + 1} / {menus.length}
      </span>
    </div>
  );
}
