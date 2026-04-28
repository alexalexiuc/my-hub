'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, CategoryIcon } from '../ui';
import type { CategoriesResponse } from '@/app/api/finances/contracts';

function lastNMonths(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' }),
    };
  });
}

export default function BudgetPage() {
  const months = lastNMonths(4);
  const [selectedMonth, setSelectedMonth] = useState(months[0]!.value);
  const [data, setData] = useState<CategoriesResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  const currency = data?.currency ?? 'EUR';
  const budgetCats = data?.allCategories.filter(c => c.monthlyTarget != null && c.monthlyTarget > 0) ?? [];
  const sortedCats = [...(data?.allCategories ?? [])].sort((a, b) => b.spent - a.spent);
  const totalBudget = budgetCats.reduce((s, c) => s + (c.monthlyTarget ?? 0), 0);
  const totalSpent = budgetCats.reduce((s, c) => s + c.spent, 0);
  const left = totalBudget - totalSpent;
  const maxBar = Math.max(...sortedCats.map(c => Math.max(c.monthlyTarget ?? 0, c.spent)), 1);
  const overBudget = budgetCats.filter(c => c.spent > (c.monthlyTarget ?? 0));

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Budget Report</div>

      {/* Month picker */}
      <div className="flex flex-wrap gap-1.5">
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
          {[60, 300].map((h, i) => (
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
            {/* Summary row */}
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: 'Budget', value: fmt(totalBudget, currency), color: 'var(--fin-blue)' },
                {
                  label: 'Spent',
                  value: fmt(totalSpent, currency),
                  color: totalSpent > totalBudget ? 'var(--fin-red)' : 'var(--fin-text)',
                },
                {
                  label: 'Left',
                  value: fmt(Math.abs(left), currency),
                  color: left < 0 ? 'var(--fin-red)' : 'var(--fin-green)',
                },
              ].map(s => (
                <Card key={s.label} className="px-3 py-2.5 text-center">
                  <div className="mb-1 text-[9px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">{s.label}</div>
                  <div className="text-base font-bold" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </Card>
              ))}
            </div>

            {/* Category bars */}
            <Card className="p-4">
              <SectionLabel className="mb-3">Categories vs Target</SectionLabel>
              <div className="flex flex-col gap-3">
                {sortedCats.map(cat => {
                  const target = cat.monthlyTarget ?? 0;
                  const pct = target > 0 ? Math.min(100, (cat.spent / target) * 100) : 100;
                  const barColor =
                    pct >= 100 ? 'var(--fin-red)' : pct >= 80 ? 'var(--fin-amber)' : (cat.color ?? 'var(--fin-green)');
                  const over = target > 0 && cat.spent > target;
                  return (
                    <div key={cat.id}>
                      <div className="mb-[5px] flex justify-between">
                        <div className="flex items-center gap-1.5">
                          <CategoryIcon color={cat.color} icon={cat.icon} size="sm" />
                          <span className="text-[13px] text-[var(--fin-text)]">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-right text-[11px] text-[var(--fin-muted)]">
                          <span
                            className={cn('font-semibold', over ? 'text-[var(--fin-red)]' : 'text-[var(--fin-text)]')}
                          >
                            {fmt(cat.spent, currency)}
                          </span>
                          {target > 0 && <span className="text-[var(--fin-subtle)]">/ {fmt(target, currency)}</span>}
                          {over && (
                            <span className="rounded px-[5px] py-[1px] text-[10px] text-[var(--fin-red)] bg-[var(--fin-red-d)]">
                              +{fmt(cat.spent - target, currency)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative h-2 overflow-hidden rounded bg-[var(--fin-card2)]">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.min(100, target > 0 ? pct : (cat.spent / maxBar) * 100)}%`,
                            background: barColor,
                            transition: 'width .4s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {sortedCats.length === 0 && (
                  <div className="py-4 text-center text-xs text-[var(--fin-subtle)]">No spending this month</div>
                )}
              </div>
            </Card>

            {/* Over-budget alert */}
            {overBudget.length > 0 && (
              <div
                className="rounded-[10px] px-[14px] py-3 bg-[var(--fin-red-d)]"
                style={{ border: `1px solid var(--fin-red)44` }}
              >
                <div className="mb-1 text-xs font-semibold text-[var(--fin-red)]">Over budget</div>
                {overBudget.map(c => (
                  <div key={c.id} className="flex justify-between py-[2px] text-xs text-[var(--fin-muted)]">
                    <span className="flex items-center gap-1.5">
                      <CategoryIcon color={c.color} icon={c.icon} size="sm" />
                      {c.name}
                    </span>
                    <span className="text-[var(--fin-red)]">
                      +{fmt(c.spent - (c.monthlyTarget ?? 0), currency)} (
                      {Math.round(((c.spent - (c.monthlyTarget ?? 0)) / (c.monthlyTarget ?? 1)) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
