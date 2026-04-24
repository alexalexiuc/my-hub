'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel, Divider, Bar } from '../ui';
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[44, 60, 260].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Cashflow</div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(
          [
            ['monthly', 'Monthly'],
            ['breakdown', 'By Category'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 11,
              cursor: 'pointer',
              background: view === v ? T.accentD : T.card2,
              border: view === v ? `1px solid ${T.accent}44` : `1px solid ${T.border}`,
              color: view === v ? T.accent : T.muted,
              fontWeight: view === v ? 600 : 400,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* 3-stat summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Income', value: fmt(totalIncome, currency), color: T.green },
          { label: 'Expense', value: fmt(totalExpense, currency), color: T.red },
          { label: 'Net', value: fmt(Math.abs(net), currency), color: net >= 0 ? T.green : T.red },
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
            <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {view === 'monthly' ? (
        <Card style={{ padding: 16 }}>
          <SectionLabel style={{ marginBottom: 12 }}>6-Month Cashflow</SectionLabel>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginBottom: 8 }}>
            {cashflow.map((d, i) => {
              const iH = Math.max(2, (d.income / maxVal) * 110);
              const eH = Math.max(2, (d.expense / maxVal) * 110);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
                    <div
                      style={{
                        width: '44%',
                        height: iH,
                        borderRadius: '3px 3px 0 0',
                        background: T.green,
                        opacity: 0.75,
                      }}
                      title={`Income: ${fmt(d.income, currency)}`}
                    />
                    <div
                      style={{
                        width: '44%',
                        height: eH,
                        borderRadius: '3px 3px 0 0',
                        background: T.red,
                        opacity: 0.75,
                      }}
                      title={`Expense: ${fmt(d.expense, currency)}`}
                    />
                  </div>
                  <div style={{ fontSize: 9, color: T.subtle, marginTop: 4 }}>{d.month}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            {[
              { color: T.green, label: 'Income' },
              { color: T.red, label: 'Expenses' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, opacity: 0.75 }} />
                <span style={{ fontSize: 10, color: T.muted }}>{l.label}</span>
              </div>
            ))}
          </div>
          {/* Table */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            {cashflow.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: i < cashflow.length - 1 ? `1px solid ${T.border}22` : 'none',
                }}
              >
                <span style={{ fontSize: 12, color: T.muted, width: 40 }}>{d.month}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: T.green,
                    width: 90,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  +{fmt(d.income, currency)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: T.red,
                    width: 90,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  -{fmt(d.expense, currency)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: d.income - d.expense >= 0 ? T.green : T.red,
                    width: 90,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
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
        <Card style={{ padding: 16 }}>
          <SectionLabel style={{ marginBottom: 12 }}>
            By Category — {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
          </SectionLabel>
          {!catData ? (
            <div style={{ height: 120, background: T.card2, borderRadius: 8, opacity: 0.5 }} />
          ) : catData.allCategories.filter(c => c.spent > 0).length === 0 ? (
            <div style={{ fontSize: 12, color: T.subtle, textAlign: 'center', padding: '24px 0' }}>
              No spending this month
            </div>
          ) : (
            catData.allCategories
              .filter(c => c.spent > 0)
              .sort((a, b) => b.spent - a.spent)
              .map((cat, i) => (
                <div key={cat.id}>
                  {i > 0 && <Divider />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: (cat.color ?? T.muted) + '20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        border: `1px solid ${cat.color ?? T.muted}2a`,
                      }}
                    >
                      {cat.icon ?? '•'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: T.text }}>{cat.name}</div>
                      <Bar
                        value={cat.spent}
                        max={cat.monthlyTarget ?? cat.spent}
                        color={cat.color ?? T.green}
                        height={3}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fmt(cat.spent, currency)}</div>
                      <div style={{ fontSize: 10, color: T.subtle }}>
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
