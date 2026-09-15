'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Collapsible, Pill } from '@/components';
import { apiFetch } from '@/lib/utils';
import { formatMonthShortStr } from '@my-hub/shared/utils';
import { CategoryIcon, FlowInOut, TYPE_META } from '../ui';
import { FlowRow } from './FlowRow';
import { hasAccountActivity } from './cashflow.utils';
import { accountFlowsReportResponseSchema } from '@/app/api/finances/reports/account-flows/account-flows.schema';
import type {
  AccountFlowsReportData,
  MonthlyAccountFlow,
} from '@/app/api/finances/reports/account-flows/account-flows.schema';

type AccountCashflowSectionProps = {
  year: number;
};

type AccountFlowCardProps = {
  account: MonthlyAccountFlow;
  year: number;
};

function AccountFlowCard({ account, year }: AccountFlowCardProps) {
  const meta = TYPE_META[account.accountType];

  return (
    <Collapsible
      label={account.accountName}
      defaultOpen
      leading={
        <CategoryIcon color={meta?.color ?? null} size="sm">
          {meta?.icon ?? '•'}
        </CategoryIcon>
      }
      inlineActions={meta && <Pill label={meta.label} color={meta.color} />}
      actions={
        <Button variant="ghost" size="xs" href={`/finances/accounts/${account.accountId}`}>
          Open →
        </Button>
      }
      contentClassName="flex flex-col gap-2.5"
    >
      <FlowInOut
        inflows={account.totalInflows}
        outflows={account.totalOutflows}
        currency={account.currency}
        inLabel={`In ${year}`}
        outLabel={`Out ${year}`}
      />

      <div className="border-t border-[var(--border)] pt-2">
        {account.months.map((m, i) => (
          <FlowRow
            key={m.month}
            label={formatMonthShortStr(m.month)}
            inflow={m.inflows}
            outflow={m.outflows}
            currency={account.currency}
            divider={i < account.months.length - 1}
          />
        ))}
      </div>
    </Collapsible>
  );
}

/**
 * Per-account money in/out for each month of the selected year — the same in/out decomposition the
 * account detail page shows for the current month, repeated per month. Loads its own data.
 */
export function AccountCashflowSection({ year }: AccountCashflowSectionProps) {
  const [data, setData] = useState<AccountFlowsReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    apiFetch('/api/finances/reports/account-flows', {
      query: { year },
      responseSchema: accountFlowsReportResponseSchema,
      silentToast: true,
    })
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load account flows');
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (error) return <div className="py-12 text-center text-[13px] text-[var(--red)]">{error}</div>;

  if (!data) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[150, 150].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] opacity-60"
            style={{ height: h }}
          />
        ))}
      </div>
    );
  }

  const active = data.accounts.filter(hasAccountActivity);

  if (active.length === 0) {
    return (
      <Card className="p-4">
        <div className="py-6 text-center text-xs text-[var(--subtle)]">No account activity in {year}</div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {active.map(account => (
        <AccountFlowCard key={account.accountId} account={account} year={year} />
      ))}
    </div>
  );
}
