'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel } from '../ui';

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
  month: string;
  allCategories: CatRow[];
  totalSpent: number;
}

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
  const [data, setData] = useState<CategoriesData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const currency = data?.currency ?? 'EUR';
  const budgetCats = data?.allCategories.filter(c => c.monthlyTarget != null && c.monthlyTarget > 0) ?? [];
  const sortedCats = [...(data?.allCategories ?? [])].sort((a, b) => b.spent - a.spent);
  const totalBudget = budgetCats.reduce((s, c) => s + (c.monthlyTarget ?? 0), 0);
  const totalSpent = budgetCats.reduce((s, c) => s + c.spent, 0);
  const left = totalBudget - totalSpent;
  const maxBar = Math.max(...sortedCats.map(c => Math.max(c.monthlyTarget ?? 0, c.spent)), 1);
  const overBudget = budgetCats.filter(c => c.spent > (c.monthlyTarget ?? 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Budget Report</div>

      {/* Month picker */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
          {[60, 300].map((h, i) => (
            <div
              key={i}
              style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        data && (
          <>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Budget', value: fmt(totalBudget, currency), color: T.blue },
                { label: 'Spent', value: fmt(totalSpent, currency), color: totalSpent > totalBudget ? T.red : T.text },
                { label: 'Left', value: fmt(Math.abs(left), currency), color: left < 0 ? T.red : T.green },
              ].map(s => (
                <Card key={s.label} style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: T.subtle,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      marginBottom: 4,
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                </Card>
              ))}
            </div>

            {/* Category bars */}
            <Card style={{ padding: 16 }}>
              <SectionLabel style={{ marginBottom: 12 }}>Categories vs Target</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sortedCats.map(cat => {
                  const target = cat.monthlyTarget ?? 0;
                  const pct = target > 0 ? Math.min(100, (cat.spent / target) * 100) : 100;
                  const barColor = pct >= 100 ? T.red : pct >= 80 ? T.amber : (cat.color ?? T.green);
                  const over = target > 0 && cat.spent > target;
                  return (
                    <div key={cat.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cat.icon && <span style={{ fontSize: 13 }}>{cat.icon}</span>}
                          <span style={{ fontSize: 13, color: T.text }}>{cat.name}</span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: T.muted,
                            textAlign: 'right',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ color: over ? T.red : T.text, fontWeight: 600 }}>
                            {fmt(cat.spent, currency)}
                          </span>
                          {target > 0 && <span style={{ color: T.subtle }}>/ {fmt(target, currency)}</span>}
                          {over && (
                            <span
                              style={{
                                fontSize: 10,
                                color: T.red,
                                background: T.redD,
                                padding: '1px 5px',
                                borderRadius: 4,
                              }}
                            >
                              +{fmt(cat.spent - target, currency)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          position: 'relative',
                          height: 8,
                          borderRadius: 4,
                          background: T.card2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, target > 0 ? pct : (cat.spent / maxBar) * 100)}%`,
                            borderRadius: 4,
                            background: barColor,
                            transition: 'width .4s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {sortedCats.length === 0 && (
                  <div style={{ fontSize: 12, color: T.subtle, textAlign: 'center', padding: '16px 0' }}>
                    No spending this month
                  </div>
                )}
              </div>
            </Card>

            {/* Over-budget alert */}
            {overBudget.length > 0 && (
              <div
                style={{ background: T.redD, border: `1px solid ${T.red}44`, borderRadius: 10, padding: '12px 14px' }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: T.red, marginBottom: 4 }}>Over budget</div>
                {overBudget.map(c => (
                  <div
                    key={c.id}
                    style={{
                      fontSize: 12,
                      color: T.muted,
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '2px 0',
                    }}
                  >
                    <span>
                      {c.icon} {c.name}
                    </span>
                    <span style={{ color: T.red }}>
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
