'use client';

import { Card, SectionLabel } from '@/components';
import { cn } from '@/lib/utils';
import { formatMonthShortStr } from '@my-hub/shared/utils';
import { CashflowBarChart } from '../CashflowBarChart';
import { FlowRow } from './FlowRow';
import type { CashflowMonth } from '@/app/api/finances/reports/reports.schema';

type MonthlyCashflowSectionProps = {
  cashflow: CashflowMonth[];
  currency: string;
  year: number;
};

const LEGEND = [
  { colorClass: 'bg-[var(--green)]', label: 'Income' },
  { colorClass: 'bg-[var(--red)]', label: 'Expenses' },
];

/** Whole-budget income vs expenses month by month: grouped bars plus a per-month table. */
export function MonthlyCashflowSection({ cashflow, currency, year }: MonthlyCashflowSectionProps) {
  const chartData = cashflow.map(d => ({
    label: formatMonthShortStr(d.month),
    income: d.income,
    expense: d.expense,
  }));

  return (
    <Card className="p-4">
      <SectionLabel className="mb-3">Monthly cashflow — {year}</SectionLabel>

      {cashflow.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--subtle)]">No cashflow in {year}</div>
      ) : (
        <>
          <div className="mb-2 h-[160px]">
            <CashflowBarChart data={chartData} currency={currency} />
          </div>

          <div className="mb-[14px] flex gap-4">
            {LEGEND.map(l => (
              <div key={l.label} className="flex items-center gap-[5px]">
                <div className={cn('h-[10px] w-[10px] rounded-sm opacity-75', l.colorClass)} />
                <span className="text-[10px] text-[var(--muted)]">{l.label}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            {cashflow.map((d, i) => (
              <FlowRow
                key={d.month}
                label={formatMonthShortStr(d.month)}
                inflow={d.income}
                outflow={d.expense}
                currency={currency}
                divider={i < cashflow.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
