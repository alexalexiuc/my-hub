'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { fmt, Card, Divider, SubText } from '../ui';
import { CatRow } from './CatRow';
import type { CategoryGroup, CategoryRow } from '@/app/api/finances/categories/route';

type GroupSectionProps = {
  group: CategoryGroup;
  currency: string;
  onAddCategory: (groupId: number) => void;
  onEditGroup: (group: CategoryGroup) => void;
  onEditCategory: (cat: CategoryRow) => void;
  onDeleteCategory: (cat: CategoryRow) => void;
  onOpenCategory?: (cat: CategoryRow) => void;
  onChanged: () => void;
};

function groupColor(group: CategoryGroup): string {
  return group.categories.find(c => c.color)?.color ?? 'var(--muted)';
}

export function GroupSection({
  group,
  currency,
  onAddCategory,
  onEditGroup,
  onEditCategory,
  onDeleteCategory,
  onOpenCategory,
  onChanged,
}: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);

  const color = groupColor(group);
  const groupSpent = group.categories.reduce((s, c) => s + c.spent, 0);
  const groupTarget = group.categories.reduce((s, c) => s + (c.monthlyTarget ?? 0), 0);
  const groupPct = groupTarget > 0 ? Math.min(100, Math.round((groupSpent / groupTarget) * 100)) : null;

  async function deleteGroup() {
    if (!window.confirm(`Delete group "${group.name}"? Categories in this group will become ungrouped.`)) return;
    await apiFetch(`/api/finances/groups/${group.id}`, { method: 'DELETE', silentToast: true });
    onChanged();
  }

  return (
    <div>
      <div className="group/header mb-1.5 flex items-center justify-between px-1 py-[6px]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
          <button
            onClick={() => setCollapsed(v => !v)}
            className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0"
          >
            <span className="text-[13px] font-semibold text-[var(--text)]">{group.name}</span>
            <SubText>{collapsed ? '▶' : '▾'}</SubText>
          </button>
          {/* Always visible on mobile, hover-only on desktop */}
          <div className="flex items-center gap-0.5 transition-opacity md:opacity-0 md:group-hover/header:opacity-100">
            <button
              aria-label={`Edit group ${group.name}`}
              onClick={() => onEditGroup(group)}
              className="cursor-pointer rounded p-0.5 text-[var(--subtle)] hover:bg-[var(--card2)] hover:text-[var(--text)]"
            >
              <PencilIcon className="size-[11px]" />
            </button>
            <button
              aria-label={`Delete group ${group.name}`}
              onClick={deleteGroup}
              className="cursor-pointer rounded p-0.5 text-[var(--subtle)] hover:bg-[var(--card2)] hover:text-red-400"
            >
              <TrashOutlineIcon className="size-[11px]" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {groupTarget > 0 && (
            <SubText>
              {fmt(groupSpent, currency)} / {fmt(groupTarget, currency)}
            </SubText>
          )}
          {groupPct !== null && (
            <span
              className="rounded-[20px] px-[7px] py-[2px] text-[10px] font-semibold"
              style={{ background: color + '22', color }}
            >
              {groupPct}%
            </span>
          )}
        </div>
      </div>
      {!collapsed && (
        <Card className="py-[6px]">
          {group.categories.map((cat, i) => (
            <div key={cat.id}>
              {i > 0 && <Divider />}
              <CatRow
                cat={cat}
                currency={currency}
                isSwipeOpen={openSwipeId === cat.id}
                onSwipeOpen={() => setOpenSwipeId(cat.id)}
                onSwipeClose={() => setOpenSwipeId(null)}
                onEdit={onEditCategory}
                onDelete={onDeleteCategory}
                onOpen={onOpenCategory}
              />
            </div>
          ))}
          {group.categories.length === 0 && (
            <div className="p-[14px] text-center text-xs text-[var(--subtle)]">No categories in this group</div>
          )}
          {group.categories.length > 0 && <Divider />}
          <button
            onClick={() => onAddCategory(group.id)}
            className="w-full cursor-pointer border-none bg-transparent px-[14px] py-[10px] text-left text-[12px] text-[var(--subtle)] hover:text-[var(--text)]"
          >
            + Add category
          </button>
        </Card>
      )}
    </div>
  );
}
