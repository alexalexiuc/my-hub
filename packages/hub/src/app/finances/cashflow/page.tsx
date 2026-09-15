'use client';

import { useState, useEffect } from 'react';
import { Button, YearNav } from '@/components';
import { apiFetch } from '@/lib/utils';
import { CashflowSummaryCards } from '../CashflowSummaryCards';
import { CashflowPageSkeleton } from './CashflowPageSkeleton';
import { MonthlyCashflowSection } from './MonthlyCashflowSection';
import { CategoryCashflowSection } from './CategoryCashflowSection';
import { AccountCashflowSection } from './AccountCashflowSection';
import { reportsResponseSchema } from '@/app/api/finances/reports/reports.schema';
import type { ReportsData } from '@/app/api/finances/reports/reports.schema';

const VIEWS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'accounts', label: 'By Account' },
  { value: 'breakdown', label: 'By Category' },
] as const;

type View = (typeof VIEWS)[number]['value'];

export default function CashflowPage() {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<ReportsData | null>(null);
  const [view, setView] = useState<View>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch('/api/finances/reports', {
      query: { year },
      responseSchema: reportsResponseSchema,
      silentToast: true,
    })
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load cashflow');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const currency = data?.currency ?? 'EUR';
  const cashflow = data?.cashflow ?? [];
  const totalIncome = cashflow.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = cashflow.reduce((sum, m) => sum + m.expense, 0);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Cashflow</div>

      <YearNav year={year} onChange={setYear} maxYear={currentYear} currentYear={currentYear} />

      <div className="flex gap-1.5">
        {VIEWS.map(v => (
          <Button key={v.value} variant="fin-pill" size="xs" active={view === v.value} onClick={() => setView(v.value)}>
            {v.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <CashflowPageSkeleton />
      ) : error ? (
        <div className="py-12 text-center text-[13px] text-[var(--red)]">{error}</div>
      ) : (
        <>
          <CashflowSummaryCards
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            net={totalIncome - totalExpenses}
            currency={currency}
          />

          {view === 'monthly' && <MonthlyCashflowSection cashflow={cashflow} currency={currency} year={year} />}
          {view === 'accounts' && <AccountCashflowSection year={year} />}
          {view === 'breakdown' && <CategoryCashflowSection year={year} />}
        </>
      )}
    </div>
  );
}
