'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/utils';
import type { CategoriesResponse, CategoryGroup, CategoryRow } from '@/app/api/finances/categories/route';
import type { CategoryDeleteResponse } from '@/app/api/finances/categories/[id]/route';
import { fmt, Card, SectionLabel, Divider, SmartDatePicker } from '../ui';
import { dateToString } from '@my-hub/shared/utils';
import { Button } from '@/components';
import { CategoryModal } from './CategoryModal';
import { GroupModal } from './GroupModal';
import { GroupSection } from './GroupSection';
import { CatRow } from './CatRow';
import { categoryToEditValues } from '../finances-form.schema';
import { normalizeYearMonth } from '../finances.utils';

const CURRENT_MONTH = dateToString(new Date(), 'YYYY-MM');

export default function CategoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthFromQuery = useMemo(() => normalizeYearMonth(searchParams.get('month')), [searchParams]);
  const [selectedMonth, setSelectedMonth] = useState(monthFromQuery);
  const [data, setData] = useState<CategoriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addCategoryGroupId, setAddCategoryGroupId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [ungroupedOpenId, setUngroupedOpenId] = useState<number | null>(null);

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

  useEffect(() => {
    setSelectedMonth(monthFromQuery);
  }, [monthFromQuery]);

  function openAddCategory(groupId?: number) {
    setAddCategoryGroupId(groupId ?? null);
    setShowAddCategory(true);
  }

  function handleCreated() {
    setShowAddCategory(false);
    setShowAddGroup(false);
    load(selectedMonth);
  }

  function openCategory(cat: CategoryRow) {
    router.push(`/finances/categories/${cat.id}?month=${selectedMonth}`);
  }

  async function handleDeleteCategory(cat: CategoryRow) {
    if (!window.confirm(`Remove "${cat.name}"?`)) return;
    const result = await apiFetch<CategoryDeleteResponse>(`/api/finances/categories/${cat.id}`, {
      method: 'DELETE',
      silentToast: true,
    });
    if (result?.action === 'archived') {
      toast.success(`"${cat.name}" archived — it has existing transactions.`);
    } else {
      toast.success(`"${cat.name}" deleted.`);
    }
    load(selectedMonth);
  }

  const groupOptions = data?.groups.map(g => ({ id: g.id, name: g.name })) ?? [];
  const spentCategories = data?.allCategories.filter(c => c.spent > 0) ?? [];

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Categories</div>

      <SmartDatePicker
        month={selectedMonth}
        onChange={patch => patch.month && setSelectedMonth(patch.month)}
        currentMonth={CURRENT_MONTH}
      />

      {loading ? (
        <div className="flex flex-col gap-[14px]">
          {[80, 140, 120].map((h, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--border)] bg-[var(--card)]"
              style={{ height: h, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        data && (
          <>
            <Card className="p-[14px]">
              <div className="mb-2 flex justify-between">
                <span className="text-[13px] text-[var(--muted)]">Total spent</span>
                <span className="text-base font-bold text-[var(--text)]">{fmt(data.totalSpent, data.currency)}</span>
              </div>
              {data.totalSpent > 0 && (
                <>
                  <div className="flex h-2 gap-px overflow-hidden rounded">
                    {spentCategories.map(cat => {
                      const pct = (cat.spent / data.totalSpent) * 100;
                      return pct > 0.5 ? (
                        <div
                          key={cat.id}
                          title={`${cat.name}: ${fmt(cat.spent, data.currency)}`}
                          style={{ width: `${pct}%`, background: cat.color ?? 'var(--muted)', minWidth: 3 }}
                        />
                      ) : null;
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {spentCategories.map(cat => {
                      const pct = Math.round((cat.spent / data.totalSpent) * 100);
                      return (
                        <div key={cat.id} className="flex items-center gap-1">
                          <div
                            className="rounded-sm"
                            style={{ width: 7, height: 7, background: cat.color ?? 'var(--muted)' }}
                          />
                          <span className="text-[10px] text-[var(--muted)]">
                            {cat.name} <span className="text-[var(--subtle)]">{pct}%</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {data.totalSpent === 0 && (
                <div className="py-2 text-center text-xs text-[var(--subtle)]">No spending this month</div>
              )}
            </Card>

            {data.groups.map(group => (
              <GroupSection
                key={group.id}
                group={group}
                currency={data.currency}
                onAddCategory={openAddCategory}
                onEditGroup={setEditingGroup}
                onEditCategory={setEditingCategory}
                onDeleteCategory={handleDeleteCategory}
                onOpenCategory={openCategory}
                onChanged={() => load(selectedMonth)}
              />
            ))}
            <Button
              variant="transparent"
              onClick={() => setShowAddGroup(true)}
              className="cursor-pointer rounded-md border border-dashed border-[var(--border)] px-3 py-[5px] text-[11px] text-[var(--subtle)]"
            >
              + New Group
            </Button>

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
                        isSwipeOpen={ungroupedOpenId === cat.id}
                        onSwipeOpen={() => setUngroupedOpenId(cat.id)}
                        onSwipeClose={() => setUngroupedOpenId(null)}
                        onEdit={setEditingCategory}
                        onDelete={handleDeleteCategory}
                        onOpen={openCategory}
                      />
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {data.groups.length === 0 && data.ungrouped.length === 0 && (
              <div className="py-12 text-center text-[13px] text-[var(--subtle)]">
                No categories yet. Add your first category to start tracking.
              </div>
            )}
          </>
        )
      )}

      {showAddCategory && (
        <CategoryModal
          groups={groupOptions}
          defaultGroupId={addCategoryGroupId}
          onClose={() => setShowAddCategory(false)}
          onDone={handleCreated}
        />
      )}

      {showAddGroup && <GroupModal onClose={() => setShowAddGroup(false)} onDone={handleCreated} />}

      {editingGroup && (
        <GroupModal
          groupId={editingGroup.id}
          initialValues={{ name: editingGroup.name, notes: editingGroup.notes ?? '' }}
          onClose={() => setEditingGroup(null)}
          onDone={() => {
            setEditingGroup(null);
            load(selectedMonth);
          }}
        />
      )}

      {editingCategory && (
        <CategoryModal
          categoryId={editingCategory.id}
          initialValues={categoryToEditValues(editingCategory)}
          groups={groupOptions}
          onClose={() => setEditingCategory(null)}
          onDone={() => {
            setEditingCategory(null);
            load(selectedMonth);
          }}
        />
      )}
    </div>
  );
}
