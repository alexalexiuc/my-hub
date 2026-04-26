'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Divider, Bar } from '../ui';
import type { ReportsData } from '@/app/api/finances/reports/route';

interface CatRow {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  monthlyTarget: number | null;
  spent: number;
}
interface CategoriesData {
  currency: string;
  totalSpent: number;
  allCategories: CatRow[];
}

type View = 'monthly' | 'breakdown';

export default function CashflowPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [catData, setCatData] = useState<CategoriesData | null>(null);
  const [view, setView] = useState<View>('monthly');
  const [loading, setLoading] = useState(true);

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const load = useCallback(async () => {
    const result = await apiFetch<ReportsData>('/api/finances/reports?months=6', { silentToast: true });
    setData(result);
    setLoading(false);
  }, []);

  const loadCategories = useCallback(async () => {
    if (catData) return;
    const result = await apiFetch<CategoriesData>(`/api/finances/categories?month=${currentMonth}`, {
      silentToast: true,
    });
    setCatData(result);
  }, [catData, currentMonth]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (view === 'breakdown') loadCategories();
  }, [view, loadCategories]);

  const currency = data?.currency ?? 'EUR';
  const cashflow = data?.cashflow ?? [];
  const totalIncome = cashflow.reduce((s, m) => s + m.income, 0);
  const totalExpense = cashflow.reduce((s, m) => s + m.expense, 0);
  const net = totalIncome - totalExpense;
  const maxVal = Math.max(...cashflow.flatMap(d => [d.income, d.expense]), 1);

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[44, 60, 260].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border"
            style={{ height: h, background: 'var(--fin-card)', borderColor: 'var(--fin-border)', opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fin-text)' }}>
        Cashflow
      </div>

      {/* View toggle */}
      <div className="flex gap-1.5">
        {(
          [
            ['monthly', 'Monthly'],
            ['breakdown', 'By Category'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="cursor-pointer rounded-[20px] px-[14px] py-1.5 text-[11px]"
            style={{
              background: view === v ? 'var(--fin-accent-d)' : 'var(--fin-card2)',
              border: view === v ? `1px solid ${'var(--fin-accent)'}44` : `1px solid ${'var(--fin-border)'}`,
              color: view === v ? 'var(--fin-accent)' : 'var(--fin-muted)',
              fontWeight: view === v ? 600 : 400,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* 3-stat summary */}
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: 'Income', value: fmt(totalIncome, currency), color: 'var(--fin-green)' },
          { label: 'Expense', value: fmt(totalExpense, currency), color: 'var(--fin-red)' },
          {
            label: 'Net',
            value: fmt(Math.abs(net), currency),
            color: net >= 0 ? 'var(--fin-green)' : 'var(--fin-red)',
          },
        ].map(s => (
          <Card key={s.label} className="px-3 py-2.5 text-center">
            <div
              className="mb-1 text-[9px] uppercase tracking-[0.08em]"
              style={{
                color: 'var(--fin-subtle)',
              }}
            >
              {s.label}
            </div>
            <div className="text-[15px] font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      {view === 'monthly' ? (
        <Card className="p-4">
          <SectionLabel style={{ marginBottom: 12 }}>6-Month Cashflow</SectionLabel>
          {/* Bar chart */}
          <div className="mb-2 flex h-[120px] items-end gap-1.5">
            {cashflow.map((d, i) => {
              const iH = Math.max(2, (d.income / maxVal) * 110);
              const eH = Math.max(2, (d.expense / maxVal) * 110);
              return (
                <div key={i} className="flex flex-1 flex-col items-center">
                  <div className="flex h-[110px] items-end gap-0.5">
                    <div
                      style={{
                        width: '44%',
                        height: iH,
                        borderRadius: '3px 3px 0 0',
                        background: 'var(--fin-green)',
                        opacity: 0.75,
                      }}
                      title={`Income: ${fmt(d.income, currency)}`}
                    />
                    <div
                      style={{
                        width: '44%',
                        height: eH,
                        borderRadius: '3px 3px 0 0',
                        background: 'var(--fin-red)',
                        opacity: 0.75,
                      }}
                      title={`Expense: ${fmt(d.expense, currency)}`}
                    />
                  </div>
                  <div className="mt-1 text-[9px]" style={{ color: 'var(--fin-subtle)' }}>
                    {d.month}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mb-[14px] flex gap-4">
            {[
              { color: 'var(--fin-green)', label: 'Income' },
              { color: 'var(--fin-red)', label: 'Expenses' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-[5px]">
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, opacity: 0.75 }} />
                <span className="text-[10px]" style={{ color: 'var(--fin-muted)' }}>
                  {l.label}
                </span>
              </div>
            ))}
          </div>
          {/* Table */}
          <div className="pt-3" style={{ borderTop: `1px solid ${'var(--fin-border)'}` }}>
            {cashflow.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5"
                style={{
                  borderBottom: i < cashflow.length - 1 ? `1px solid ${'var(--fin-border)'}22` : 'none',
                }}
              >
                <span className="w-10 text-xs" style={{ color: 'var(--fin-muted)' }}>
                  {d.month}
                </span>
                <span
                  className="w-[90px] text-right text-xs tabular-nums"
                  style={{
                    color: 'var(--fin-green)',
                  }}
                >
                  +{fmt(d.income, currency)}
                </span>
                <span
                  className="w-[90px] text-right text-xs tabular-nums"
                  style={{
                    color: 'var(--fin-red)',
                  }}
                >
                  -{fmt(d.expense, currency)}
                </span>
                <span
                  className="w-[90px] text-right text-xs font-semibold tabular-nums"
                  style={{
                    color: d.income - d.expense >= 0 ? 'var(--fin-green)' : 'var(--fin-red)',
                  }}
                >
                  {d.income - d.expense >= 0 ? '+' : '-'}
                  {fmt(Math.abs(d.income - d.expense), currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <SectionLabel style={{ marginBottom: 12 }}>
            By Category — {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
          </SectionLabel>
          {!catData ? (
            <div className="h-[120px] rounded-lg" style={{ background: 'var(--fin-card2)', opacity: 0.5 }} />
          ) : catData.allCategories.filter(c => c.spent > 0).length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: 'var(--fin-subtle)' }}>
              No spending this month
            </div>
          ) : (
            catData.allCategories
              .filter(c => c.spent > 0)
              .sort((a, b) => b.spent - a.spent)
              .map((cat, i) => (
                <div key={cat.id}>
                  {i > 0 && <Divider />}
                  <div className="flex items-center gap-2.5 py-2">
                    <div
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[13px]"
                      style={{
                        background: (cat.color ?? 'var(--fin-muted)') + '20',
                        border: `1px solid ${cat.color ?? 'var(--fin-muted)'}2a`,
                      }}
                    >
                      {cat.icon ?? '•'}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs" style={{ color: 'var(--fin-text)' }}>
                        {cat.name}
                      </div>
                      <Bar
                        value={cat.spent}
                        max={cat.monthlyTarget ?? cat.spent}
                        color={cat.color ?? 'var(--fin-green)'}
                        height={3}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--fin-text)' }}>
                        {fmt(cat.spent, currency)}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--fin-subtle)' }}>
                        {catData.totalSpent > 0 ? Math.round((cat.spent / catData.totalSpent) * 100) : 0}% of total
                      </div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </Card>
      )}
    </div>
  );
}
