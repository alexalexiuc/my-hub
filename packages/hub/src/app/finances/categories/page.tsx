'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar, Divider, CategoryIcon } from '../ui';
import { AddCategoryModal } from './AddCategoryModal';
import { AddGroupModal } from './AddGroupModal';

interface CategoryRow {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  monthlyTarget: number | null;
  spent: number;
  groupId: number | null;
  sortOrder: number;
}
interface GroupRow {
  id: number;
  name: string;
  sortOrder: number;
  categories: CategoryRow[];
}
interface CategoriesData {
  currency: string;
  month: string;
  groups: GroupRow[];
  ungrouped: CategoryRow[];
  totalSpent: number;
  allCategories: CategoryRow[];
}

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

function groupColor(group: GroupRow): string {
  return group.categories.find(c => c.color)?.color ?? 'var(--fin-muted)';
}

function CatRow({ cat, currency }: { cat: CategoryRow; currency: string }) {
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
    <div className="px-[14px] py-[10px]">
      <div className="flex items-center gap-2.5" style={{ marginBottom: pct !== null ? 8 : 0 }}>
        <CategoryIcon color={cat.color} icon={cat.icon} size="lg" fallback={cat.name[0]?.toUpperCase() ?? '?'} />
        <div className="flex-1">
          <div className="text-[13px] font-medium" style={{ color: 'var(--fin-text)' }}>
            {cat.name}
          </div>
          {cat.monthlyTarget && (
            <div className="text-[10px]" style={{ color: 'var(--fin-subtle)' }}>
              Target {fmt(cat.monthlyTarget, currency)}/mo
            </div>
          )}
        </div>
        <div className="text-right">
          <div
            className="text-sm font-semibold"
            style={{ color: pct !== null && pct >= 100 ? 'var(--fin-red)' : 'var(--fin-text)' }}
          >
            {fmt(cat.spent, currency)}
          </div>
          {pct !== null && (
            <div className="text-[10px]" style={{ color: barColor }}>
              {pct}%
            </div>
          )}
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
}: {
  group: GroupRow;
  currency: string;
  onAddCategory: (groupId: number) => void;
}) {
  const color = groupColor(group);
  const groupSpent = group.categories.reduce((s, c) => s + c.spent, 0);
  const groupTarget = group.categories.reduce((s, c) => s + (c.monthlyTarget ?? 0), 0);
  const groupPct = groupTarget > 0 ? Math.min(100, Math.round((groupSpent / groupTarget) * 100)) : null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1 py-[6px]" style={{}}>
        <div className="flex items-center gap-2">
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--fin-text)' }}>
            {group.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {groupTarget > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--fin-subtle)' }}>
              {fmt(groupSpent, currency)} / {fmt(groupTarget, currency)}
            </span>
          )}
          {groupPct !== null && (
            <span
              className="rounded-[20px] px-[7px] py-[2px] text-[10px] font-semibold"
              style={{
                background: color + '22',
                color,
              }}
            >
              {groupPct}%
            </span>
          )}
          <button
            onClick={() => onAddCategory(group.id)}
            className="cursor-pointer rounded-md border px-2 py-[2px] text-[10px]"
            style={{
              background: 'transparent',
              border: `1px dashed ${'var(--fin-border)'}`,
              color: 'var(--fin-subtle)',
            }}
          >
            + Add
          </button>
        </div>
      </div>
      <Card className="py-[6px]">
        {group.categories.map((cat, i) => (
          <div key={cat.id}>
            {i > 0 && <Divider />}
            <CatRow cat={cat} currency={currency} />
          </div>
        ))}
        {group.categories.length === 0 && (
          <div className="p-[14px] text-center text-xs" style={{ color: 'var(--fin-subtle)' }}>
            No categories in this group
          </div>
        )}
      </Card>
    </div>
  );
}

export default function CategoriesPage() {
  const months = lastNMonths(3);
  const [selectedMonth, setSelectedMonth] = useState(months[0]!.value);
  const [data, setData] = useState<CategoriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addCategoryGroupId, setAddCategoryGroupId] = useState<number | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);

  const load = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const result = await apiFetch<CategoriesData>(`/api/finances/categories?month=${month}`, { silentToast: true });
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
    setShowNewMenu(false);
  }

  function handleCreated() {
    setShowAddCategory(false);
    setShowAddGroup(false);
    load(selectedMonth);
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fin-text)' }}>
          Categories
        </div>
        <div className="relative">
          <button
            onClick={() => setShowNewMenu(v => !v)}
            className="cursor-pointer rounded-[20px] border px-3 py-1.5 text-[11px]"
            style={{
              background: 'var(--fin-card2)',
              border: `1px solid ${'var(--fin-border)'}`,
              color: 'var(--fin-muted)',
            }}
          >
            + New
          </button>
          {showNewMenu && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-[100] min-w-[150px] rounded-[10px] p-1"
              style={{
                background: 'var(--fin-card)',
                border: `1px solid ${'var(--fin-border)'}`,
              }}
            >
              {[
                {
                  label: '📂 New Group',
                  action: () => {
                    setShowNewMenu(false);
                    setShowAddGroup(true);
                  },
                },
                { label: '🏷 New Category', action: () => openAddCategory() },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="block w-full cursor-pointer rounded-[7px] border-none px-3 py-2 text-left text-xs"
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--fin-text)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--fin-card2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Month filter */}
      <div className="flex gap-1.5">
        {months.map(m => {
          const active = m.value === selectedMonth;
          return (
            <button
              key={m.value}
              onClick={() => setSelectedMonth(m.value)}
              className="cursor-pointer rounded-[20px] px-3 py-[5px] text-[11px]"
              style={{
                background: active ? 'var(--fin-accent-d)' : 'var(--fin-card2)',
                border: active ? `1px solid ${'var(--fin-accent)'}44` : `1px solid ${'var(--fin-border)'}`,
                color: active ? 'var(--fin-accent)' : 'var(--fin-muted)',
                fontWeight: active ? 600 : 400,
              }}
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
              className="rounded-[10px] border"
              style={{ height: h, background: 'var(--fin-card)', borderColor: 'var(--fin-border)', opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        data && (
          <>
            {/* Rainbow spend bar */}
            <Card className="p-[14px]">
              <div className="mb-2 flex justify-between">
                <span className="text-[13px]" style={{ color: 'var(--fin-muted)' }}>
                  Total spent
                </span>
                <span className="text-base font-bold" style={{ color: 'var(--fin-text)' }}>
                  {fmt(data.totalSpent, data.currency)}
                </span>
              </div>
              {data.totalSpent > 0 && (
                <>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
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
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    {data.allCategories
                      .filter(c => c.spent > 0)
                      .map(cat => (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 2,
                              background: cat.color ?? 'var(--fin-muted)',
                            }}
                          />
                          <span style={{ fontSize: 10, color: 'var(--fin-muted)' }}>{cat.name}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {data.totalSpent === 0 && (
                <div style={{ fontSize: 12, color: 'var(--fin-subtle)', textAlign: 'center', padding: '8px 0' }}>
                  No spending this month
                </div>
              )}
            </Card>

            {/* Groups */}
            {data.groups.map(group => (
              <GroupSection key={group.id} group={group} currency={data.currency} onAddCategory={openAddCategory} />
            ))}

            {/* Ungrouped */}
            {data.ungrouped.length > 0 && (
              <div>
                <SectionLabel>Ungrouped</SectionLabel>
                <Card className="py-[6px]">
                  {data.ungrouped.map((cat, i) => (
                    <div key={cat.id}>
                      {i > 0 && <Divider />}
                      <CatRow cat={cat} currency={data.currency} />
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {data.groups.length === 0 && data.ungrouped.length === 0 && (
              <div className="py-12 text-center text-[13px]" style={{ color: 'var(--fin-subtle)' }}>
                No categories yet. Add your first category to start tracking.
              </div>
            )}
          </>
        )
      )}

      {showAddCategory && (
        <AddCategoryModal
          groups={data?.groups.map(g => ({ id: g.id, name: g.name })) ?? []}
          defaultGroupId={addCategoryGroupId}
          onClose={() => setShowAddCategory(false)}
          onCreated={handleCreated}
        />
      )}

      {showAddGroup && <AddGroupModal onClose={() => setShowAddGroup(false)} onCreated={handleCreated} />}
    </div>
  );
}
