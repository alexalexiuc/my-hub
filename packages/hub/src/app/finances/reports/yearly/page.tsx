'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { YearNav } from '@/components';
import type { YearlyReportData } from '@/app/api/finances/reports/yearly/route';
import { CashflowSummaryCards } from '../../CashflowSummaryCards';
import { NetWorthAndSavings } from './NetWorthAndSavings';
import { LoansAndCategories } from './LoansAndCategories';

export default function YearlyReportPage() {
  const searchParams = useSearchParams();
  const [year, setYear] = useState(() => {
    const fromQuery = searchParams.get('year');
    return fromQuery ? parseInt(fromQuery, 10) : new Date().getUTCFullYear() - 1;
  });
  const [data, setData] = useState<YearlyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<YearlyReportData>('/api/finances/reports/yearly', { silentToast: true, query: { year } })
      .then(setData)
      .finally(() => setLoading(false));
  }, [year]);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Yearly Report</div>
        <YearNav year={year} onChange={setYear} />
      </div>

      {loading && (
        <div className="flex flex-col gap-[14px]">
          {[90, 200, 160, 220].map((h, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--border)] bg-[var(--card)]"
              style={{ height: h, opacity: 0.6 }}
            />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          <CashflowSummaryCards
            totalIncome={data.report.cashflow.totalIncome}
            totalExpenses={data.report.cashflow.totalExpenses}
            net={data.report.cashflow.net}
            currency={data.currency}
          />
          <NetWorthAndSavings report={data.report} currency={data.currency} />
          <LoansAndCategories report={data.report} currency={data.currency} />
        </>
      )}
    </div>
  );
}
