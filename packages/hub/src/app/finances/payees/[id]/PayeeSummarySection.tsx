'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, SectionLabel } from '@/components';
import { CategoryIcon, FinFieldCard, fmt } from '../../ui';
import { dateToString } from '@my-hub/shared/utils';
import type { PayeeSummaryResponse } from '@/app/api/finances/payees/[id]/route';

type PayeeSummarySectionProps = {
  payeeId: number;
};

export function PayeeSummarySection({ payeeId }: PayeeSummarySectionProps) {
  const [summary, setSummary] = useState<PayeeSummaryResponse | null>(null);

  useEffect(() => {
    apiFetch<PayeeSummaryResponse>(`/api/finances/payees/${payeeId}`, { silentToast: true }).then(setSummary);
  }, [payeeId]);

  if (!summary || summary.txCount === 0) return null;

  const { currency } = summary;

  return (
    <Card className="p-[14px]">
      <SectionLabel className="mb-2.5">Summary</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FinFieldCard label="Transactions">
          <span className="text-[15px] font-semibold tabular-nums text-[var(--text)]">{summary.txCount}</span>
        </FinFieldCard>

        <FinFieldCard label="Total Spent">
          <span className="text-[15px] font-semibold tabular-nums text-[var(--text)]">
            {fmt(summary.totalSpent, currency)}
          </span>
        </FinFieldCard>

        {summary.avgSpent != null && (
          <FinFieldCard label="Avg per Transaction">
            <span className="text-[15px] font-semibold tabular-nums text-[var(--text)]">
              {fmt(summary.avgSpent, currency)}
            </span>
          </FinFieldCard>
        )}

        {summary.totalIncome > 0 && (
          <FinFieldCard label="Total Received">
            <span className="text-[15px] font-semibold tabular-nums text-[var(--green)]">
              {fmt(summary.totalIncome, currency)}
            </span>
          </FinFieldCard>
        )}

        {summary.firstDate && (
          <FinFieldCard label="First Transaction">
            <span className="text-[13px] font-medium text-[var(--text)]">
              {dateToString(new Date(summary.firstDate))}
            </span>
          </FinFieldCard>
        )}

        {summary.lastDate && (
          <FinFieldCard label="Last Transaction">
            <span className="text-[13px] font-medium text-[var(--text)]">
              {dateToString(new Date(summary.lastDate))}
            </span>
          </FinFieldCard>
        )}

        {summary.topCategory && (
          <FinFieldCard label="Top Category">
            <div className="flex items-center gap-1.5">
              <CategoryIcon color={summary.topCategory.color} icon={summary.topCategory.icon} size="sm" />
              <span className="truncate text-[13px] font-medium text-[var(--text)]">{summary.topCategory.name}</span>
            </div>
          </FinFieldCard>
        )}

        {summary.topAccount && (
          <FinFieldCard label="Most Used Account">
            <span className="truncate text-[13px] font-medium text-[var(--text)]">{summary.topAccount.name}</span>
          </FinFieldCard>
        )}
      </div>
    </Card>
  );
}
