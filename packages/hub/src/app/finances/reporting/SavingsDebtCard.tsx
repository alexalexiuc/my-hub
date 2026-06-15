'use client';

import { Card, SectionLabel } from '@/components';
import { SimpleBarChart } from './ReportingCharts';
import type { ReportingSavingsDebtItem } from '@/app/api/finances/reporting/route';
import type { SupportedCurrency } from '@my-hub/shared/constants';

type SavingsDebtCardProps = {
  flows: ReportingSavingsDebtItem[];
  currency: SupportedCurrency;
  periodLabel: string;
};

const FLOW_COLORS: Record<ReportingSavingsDebtItem['key'], string> = {
  expenses: 'var(--red)',
  savings: 'var(--green)',
  investments: 'var(--blue)',
  debtRepayment: 'var(--amber)',
};

export function SavingsDebtCard({ flows, currency, periodLabel }: SavingsDebtCardProps) {
  if (flows.every(f => f.amount === 0 && f.prevAmount === 0)) return null;

  const items = flows.map(f => ({
    key: f.key,
    name: f.label,
    amount: f.amount,
    prevAmount: f.prevAmount,
    color: FLOW_COLORS[f.key],
  }));

  return (
    <Card className="p-[14px]">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel className="mb-0">Savings, Investments & Debt</SectionLabel>
        <span className="text-[9px] text-[var(--subtle)]">{periodLabel}</span>
      </div>
      <SimpleBarChart items={items} currency={currency} />
    </Card>
  );
}
