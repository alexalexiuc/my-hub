'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { IconButton } from '@/components';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon } from '@/components/icons';
import { formatMonthStr, shiftMonthStr } from '@my-hub/shared/utils';
import { currentMonthString } from '../../finances.utils';
import type { MonthlyReportData } from '@/app/api/finances/reports/monthly/route';
import { MonthlySummary } from './MonthlySummary';
import { AccountFlowsTable } from './AccountFlowsTable';
import { SavingsAndBudget } from './SavingsAndBudget';
import { InsightsSection } from './InsightsSection';

export default function MonthlyReportPage() {
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get('month') || shiftMonthStr(currentMonthString(), -1));
  const [data, setData] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<MonthlyReportData>('/api/finances/reports/monthly', { silentToast: true, query: { month } })
      .then(setData)
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Monthly Report</div>
        <div className="flex items-center gap-2">
          <IconButton
            label="Previous month"
            icon={<ChevronLeftOutlineIcon />}
            onClick={() => setMonth(m => shiftMonthStr(m, -1))}
          />
          <div className="min-w-[120px] text-center text-[13px] font-semibold text-[var(--text)]">
            {formatMonthStr(month)}
          </div>
          <IconButton
            label="Next month"
            icon={<ChevronRightOutlineIcon />}
            onClick={() => setMonth(m => shiftMonthStr(m, 1))}
          />
        </div>
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
          <MonthlySummary report={data.report} currency={data.currency} />
          <AccountFlowsTable report={data.report} currency={data.currency} />
          <SavingsAndBudget report={data.report} currency={data.currency} />
          <InsightsSection report={data.report} currency={data.currency} />
        </>
      )}
    </div>
  );
}
