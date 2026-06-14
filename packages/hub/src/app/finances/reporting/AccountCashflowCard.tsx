'use client';

import { Card, SectionLabel, SubText } from '@/components';
import { fmt, fmtSign } from '../ui';
import type { ReportingAccountCashflow } from '@/app/api/finances/reporting/route';

type AccountCashflowCardProps = {
  data: ReportingAccountCashflow;
  periodLabel: string;
};

export function AccountCashflowCard({ data, periodLabel }: AccountCashflowCardProps) {
  return (
    <Card className="p-[14px]">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel className="mb-0">{data.accountName} — Income vs Spending</SectionLabel>
        <span className="text-[9px] text-[var(--subtle)]">{periodLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.07em] text-[var(--muted)]">Income</div>
          <div
            className="break-all text-[15px] font-bold tracking-[-0.02em] leading-tight"
            style={{ color: 'var(--green)' }}
          >
            {fmt(data.income, data.currency)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.07em] text-[var(--muted)]">Spending</div>
          <div
            className="break-all text-[15px] font-bold tracking-[-0.02em] leading-tight"
            style={{ color: 'var(--red)' }}
          >
            {fmt(data.expenses, data.currency)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.07em] text-[var(--muted)]">Net</div>
          <div
            className="break-all text-[15px] font-bold tracking-[-0.02em] leading-tight"
            style={{ color: data.net >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {fmtSign(data.net, data.currency)}
          </div>
        </div>
      </div>
      <SubText className="mt-2 block">Spending includes categorized transfers, like loan repayments.</SubText>
    </Card>
  );
}
