'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel, Bar, Divider } from '../ui';
import { AddCategoryModal } from './AddCategoryModal';
import { AddGroupModal } from './AddGroupModal';
import { categoryIconEmoji } from '../categoryIcons';

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
  return group.categories.find(c => c.color)?.color ?? T.muted;
}

function CatRow({ cat, currency }: { cat: CategoryRow; currency: string }) {
  const pct =
    cat.monthlyTarget && cat.monthlyTarget > 0
      ? Math.min(100, Math.round((cat.spent / cat.monthlyTarget) * 100))
      : null;
  const barColor = pct !== null ? (pct >= 100 ? T.red : pct >= 80 ? T.amber : (cat.color ?? T.green)) : T.muted;

  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: pct !== null ? 8 : 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            flexShrink: 0,
            background: (cat.color ?? T.muted) + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            border: `1px solid ${cat.color ?? T.muted}2a`,
          }}
        >
          {categoryIconEmoji(cat.icon)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{cat.name}</div>
          {cat.monthlyTarget && (
            <div style={{ fontSize: 10, color: T.subtle }}>Target {fmt(cat.monthlyTarget, currency)}/mo</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: pct !== null && pct >= 100 ? T.red : T.text }}>
            {fmt(cat.spent, currency)}
          </div>
          {pct !== null && <div style={{ fontSize: 10, color: barColor }}>{pct}%</div>}
        </div>
      </div>
      {pct !== null && cat.monthlyTarget && (
        <Bar value={cat.spent} max={cat.monthlyTarget} color={cat.color ?? T.green} height={4} />
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 4px',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{group.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {groupTarget > 0 && (
            <span style={{ fontSize: 11, color: T.subtle }}>
              {fmt(groupSpent, currency)} / {fmt(groupTarget, currency)}
            </span>
          )}
          {groupPct !== null && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 20,
                background: color + '22',
                color,
              }}
            >
              {groupPct}%
            </span>
          )}
          <button
            onClick={() => onAddCategory(group.id)}
            style={{
              background: 'transparent',
              border: `1px dashed ${T.border}`,
              color: T.subtle,
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </div>
      </div>
      <Card style={{ padding: '6px 0' }}>
        {group.categories.map((cat, i) => (
          <div key={cat.id}>
            {i > 0 && <Divider />}
            <CatRow cat={cat} currency={currency} />
          </div>
        ))}
        {group.categories.length === 0 && (
          <div style={{ padding: '14px', fontSize: 12, color: T.subtle, textAlign: 'center' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Categories</div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNewMenu(v => !v)}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 11,
              background: T.card2,
              border: `1px solid ${T.border}`,
              color: T.muted,
              cursor: 'pointer',
            }}
          >
            + New
          </button>
          {showNewMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: 4,
                zIndex: 100,
                minWidth: 150,
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
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: T.text,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.card2)}
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
      <div style={{ display: 'flex', gap: 6 }}>
        {months.map(m => {
          const active = m.value === selectedMonth;
          return (
            <button
              key={m.value}
              onClick={() => setSelectedMonth(m.value)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 11,
                cursor: 'pointer',
                background: active ? T.accentD : T.card2,
                border: active ? `1px solid ${T.accent}44` : `1px solid ${T.border}`,
                color: active ? T.accent : T.muted,
                fontWeight: active ? 600 : 400,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[80, 140, 120].map((h, i) => (
            <div
              key={i}
              style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        data && (
          <>
            {/* Rainbow spend bar */}
            <Card style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: T.muted }}>Total spent</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
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
                            style={{ width: `${pct}%`, background: cat.color ?? T.muted, minWidth: 3 }}
                          />
                        ) : null;
                      })}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    {data.allCategories
                      .filter(c => c.spent > 0)
                      .map(cat => (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: cat.color ?? T.muted }} />
                          <span style={{ fontSize: 10, color: T.muted }}>{cat.name}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {data.totalSpent === 0 && (
                <div style={{ fontSize: 12, color: T.subtle, textAlign: 'center', padding: '8px 0' }}>
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
                <Card style={{ padding: '6px 0' }}>
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
              <div style={{ textAlign: 'center', padding: '48px 0', color: T.subtle, fontSize: 13 }}>
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
