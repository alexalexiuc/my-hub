'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar, Divider, CategoryIcon } from '../ui';
import { PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { Input } from '@/components';
import { AddCategoryModal } from './AddCategoryModal';
import { AddGroupModal } from './AddGroupModal';
import { EditCategoryModal } from './EditCategoryModal';
import { categoryToEditValues } from '../finances-form.schema';
import type { CategoriesResponse, CategoryGroup, CategoryRow } from '@/app/api/finances/contracts';

function lastNMonths(n: number): { label: string; value: string }[] {
  const result = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' }),
    });
  }
  return result;
}

function groupColor(group: CategoryGroup): string {
  return group.categories.find(c => c.color)?.color ?? 'var(--fin-muted)';
}

function CatRow({
  cat,
  currency,
  onEdit,
  onDelete,
}: {
  cat: CategoryRow;
  currency: string;
  onEdit: (cat: CategoryRow) => void;
  onDelete: (cat: CategoryRow) => void;
}) {
  const pct =
    cat.monthlyTarget && cat.monthlyTarget > 0
      ? Math.min(100, Math.round((cat.spent / cat.monthlyTarget) * 100))
      : null;
  const barColor =
    pct !== null
      ? pct >= 100
        ? 'var(--fin-red)'
        : pct >= 80
          ? 'var(--fin-amber)'
          : (cat.color ?? 'var(--fin-green)')
      : 'var(--fin-muted)';

  return (
    <div className="group px-[14px] py-[10px]">
      <div className={cn('flex items-center gap-2.5', pct !== null ? 'mb-2' : 'mb-0')}>
        <CategoryIcon color={cat.color} icon={cat.icon} size="lg" fallback={cat.name[0]?.toUpperCase() ?? '?'} />
        <div className="flex-1">
          <div className="text-[13px] font-medium text-[var(--fin-text)]">{cat.name}</div>
          {cat.monthlyTarget && (
            <div className="text-[10px] text-[var(--fin-subtle)]">Target {fmt(cat.monthlyTarget, currency)}/mo</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div
              className={cn(
                'text-sm font-semibold',
                pct !== null && pct >= 100 ? 'text-[var(--fin-red)]' : 'text-[var(--fin-text)]',
              )}
            >
              {fmt(cat.spent, currency)}
            </div>
            {pct !== null && (
              <div className="text-[10px]" style={{ color: barColor }}>
                {pct}%
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              aria-label={`Edit category ${cat.name}`}
              onClick={() => onEdit(cat)}
              className="cursor-pointer rounded p-1 text-[var(--fin-subtle)] hover:bg-[var(--fin-card2)] hover:text-[var(--fin-text)]"
            >
              <PencilIcon className="size-3" />
            </button>
            <button
              aria-label={`Delete category ${cat.name}`}
              onClick={() => onDelete(cat)}
              className="cursor-pointer rounded p-1 text-[var(--fin-subtle)] hover:bg-[var(--fin-card2)] hover:text-red-400"
            >
              <TrashOutlineIcon className="size-3" />
            </button>
          </div>
        </div>
      </div>
      {pct !== null && cat.monthlyTarget && (
        <Bar value={cat.spent} max={cat.monthlyTarget} color={cat.color ?? 'var(--fin-green)'} height={4} />
      )}
    </div>
  );
}

function GroupSection({
  group,
  currency,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onChanged,
}: {
  group: CategoryGroup;
  currency: string;
  onAddCategory: (groupId: number) => void;
  onEditCategory: (cat: CategoryRow) => void;
  onDeleteCategory: (cat: CategoryRow) => void;
  onChanged: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const color = groupColor(group);
  const groupSpent = group.categories.reduce((s, c) => s + c.spent, 0);
  const groupTarget = group.categories.reduce((s, c) => s + (c.monthlyTarget ?? 0), 0);
  const groupPct = groupTarget > 0 ? Math.min(100, Math.round((groupSpent / groupTarget) * 100)) : null;

  async function saveGroupName() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === group.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/finances/groups/${group.id}`, {
        method: 'PATCH',
        body: { name: trimmed },
        silentToast: true,
      });
      onChanged();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function deleteGroup() {
    if (!window.confirm(`Delete group "${group.name}"? Categories in this group will become ungrouped.`)) return;
    await apiFetch(`/api/finances/groups/${group.id}`, { method: 'DELETE', silentToast: true });
    onChanged();
  }

  return (
    <div>
      <div className="group/header mb-1.5 flex items-center justify-between px-1 py-[6px]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
          {editing ? (
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveGroupName();
                if (e.key === 'Escape') {
                  setEditing(false);
                  setEditName(group.name);
                }
              }}
              onBlur={saveGroupName}
              disabled={saving}
              autoFocus
              className="h-6 w-full max-w-[180px] py-0 text-[13px] font-semibold"
            />
          ) : (
            <>
              <button
                onClick={() => setCollapsed(v => !v)}
                className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0"
              >
                <span className="text-[13px] font-semibold text-[var(--fin-text)]">{group.name}</span>
                <span className="text-[10px] text-[var(--fin-subtle)]">{collapsed ? '▶' : '▾'}</span>
              </button>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/header:opacity-100">
                <button
                  aria-label={`Edit group ${group.name}`}
                  onClick={() => {
                    setEditing(true);
                    setEditName(group.name);
                  }}
                  className="cursor-pointer rounded p-0.5 text-[var(--fin-subtle)] hover:bg-[var(--fin-card2)] hover:text-[var(--fin-text)]"
                >
                  <PencilIcon className="size-[11px]" />
                </button>
                <button
                  aria-label={`Delete group ${group.name}`}
                  onClick={deleteGroup}
                  className="cursor-pointer rounded p-0.5 text-[var(--fin-subtle)] hover:bg-[var(--fin-card2)] hover:text-red-400"
                >
                  <TrashOutlineIcon className="size-[11px]" />
                </button>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {groupTarget > 0 && (
            <span className="text-[11px] text-[var(--fin-subtle)]">
              {fmt(groupSpent, currency)} / {fmt(groupTarget, currency)}
            </span>
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
              <CatRow cat={cat} currency={currency} onEdit={onEditCategory} onDelete={onDeleteCategory} />
            </div>
          ))}
          {group.categories.length === 0 && (
            <div className="p-[14px] text-center text-xs text-[var(--fin-subtle)]">No categories in this group</div>
          )}
          {group.categories.length > 0 && <Divider />}
          <button
            onClick={() => onAddCategory(group.id)}
            className="w-full cursor-pointer border-none bg-transparent px-[14px] py-[10px] text-left text-[12px] text-[var(--fin-subtle)] hover:text-[var(--fin-text)]"
          >
            + Add category
          </button>
        </Card>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const months = lastNMonths(3);
  const [selectedMonth, setSelectedMonth] = useState(months[0]!.value);
  const [data, setData] = useState<CategoriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addCategoryGroupId, setAddCategoryGroupId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);

  const load = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const result = await apiFetch<CategoriesResponse>(`/api/finances/categories?month=${month}`, {
        silentToast: true,
      });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedMonth);
  }, [selectedMonth, load]);

  function openAddCategory(groupId?: number) {
    setAddCategoryGroupId(groupId ?? null);
    setShowAddCategory(true);
  }

  function handleCreated() {
    setShowAddCategory(false);
    setShowAddGroup(false);
    load(selectedMonth);
  }

  async function handleDeleteCategory(cat: CategoryRow) {
    if (!window.confirm(`Remove "${cat.name}"?`)) return;
    const result = await apiFetch<{ id: number; action: 'archived' | 'deleted' }>(
      `/api/finances/categories/${cat.id}`,
      { method: 'DELETE', silentToast: true },
    );
    if (result?.action === 'archived') {
      toast.success(`"${cat.name}" archived — it has existing transactions.`);
    } else {
      toast.success(`"${cat.name}" deleted.`);
    }
    load(selectedMonth);
  }

  const groupOptions = data?.groups.map(g => ({ id: g.id, name: g.name })) ?? [];

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Categories</div>

      <div className="flex gap-1.5">
        {months.map(m => {
          const active = m.value === selectedMonth;
          return (
            <button
              key={m.value}
              onClick={() => setSelectedMonth(m.value)}
              className={cn(
                'cursor-pointer rounded-[20px] px-3 py-[5px] text-[11px]',
                active
                  ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)] font-semibold'
                  : 'bg-[var(--fin-card2)] text-[var(--fin-muted)]',
              )}
              style={{ border: active ? `1px solid var(--fin-accent)44` : `1px solid var(--fin-border)` }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col gap-[14px]">
          {[80, 140, 120].map((h, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
              style={{ height: h, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        data && (
          <>
            <Card className="p-[14px]">
              <div className="mb-2 flex justify-between">
                <span className="text-[13px] text-[var(--fin-muted)]">Total spent</span>
                <span className="text-base font-bold text-[var(--fin-text)]">
                  {fmt(data.totalSpent, data.currency)}
                </span>
              </div>
              {data.totalSpent > 0 && (
                <>
                  <div className="flex h-2 gap-px overflow-hidden rounded">
                    {data.allCategories
                      .filter(c => c.spent > 0)
                      .map(cat => {
                        const pct = (cat.spent / data.totalSpent) * 100;
                        return pct > 0.5 ? (
                          <div
                            key={cat.id}
                            title={`${cat.name}: ${fmt(cat.spent, data.currency)}`}
                            style={{ width: `${pct}%`, background: cat.color ?? 'var(--fin-muted)', minWidth: 3 }}
                          />
                        ) : null;
                      })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {data.allCategories
                      .filter(c => c.spent > 0)
                      .map(cat => (
                        <div key={cat.id} className="flex items-center gap-1">
                          <div
                            className="rounded-sm"
                            style={{ width: 7, height: 7, background: cat.color ?? 'var(--fin-muted)' }}
                          />
                          <span className="text-[10px] text-[var(--fin-muted)]">{cat.name}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {data.totalSpent === 0 && (
                <div className="py-2 text-center text-xs text-[var(--fin-subtle)]">No spending this month</div>
              )}
            </Card>

            {data.groups.map(group => (
              <GroupSection
                key={group.id}
                group={group}
                currency={data.currency}
                onAddCategory={openAddCategory}
                onEditCategory={setEditingCategory}
                onDeleteCategory={handleDeleteCategory}
                onChanged={() => load(selectedMonth)}
              />
            ))}
            <button
              onClick={() => setShowAddGroup(true)}
              className="cursor-pointer rounded-md border border-dashed border-[var(--fin-border)] bg-transparent px-3 py-[5px] text-[11px] text-[var(--fin-subtle)]"
            >
              + New Group
            </button>

            {data.ungrouped.length > 0 && (
              <div>
                <SectionLabel>Ungrouped</SectionLabel>
                <Card className="py-[6px]">
                  {data.ungrouped.map((cat, i) => (
                    <div key={cat.id}>
                      {i > 0 && <Divider />}
                      <CatRow
                        cat={cat}
                        currency={data.currency}
                        onEdit={setEditingCategory}
                        onDelete={handleDeleteCategory}
                      />
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {data.groups.length === 0 && data.ungrouped.length === 0 && (
              <div className="py-12 text-center text-[13px] text-[var(--fin-subtle)]">
                No categories yet. Add your first category to start tracking.
              </div>
            )}
          </>
        )
      )}

      {showAddCategory && (
        <AddCategoryModal
          groups={groupOptions}
          defaultGroupId={addCategoryGroupId}
          onClose={() => setShowAddCategory(false)}
          onCreated={handleCreated}
        />
      )}

      {showAddGroup && <AddGroupModal onClose={() => setShowAddGroup(false)} onCreated={handleCreated} />}

      {editingCategory && (
        <EditCategoryModal
          categoryId={editingCategory.id}
          initialValues={categoryToEditValues(editingCategory)}
          groups={groupOptions}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            setEditingCategory(null);
            load(selectedMonth);
          }}
        />
      )}
    </div>
  );
}
