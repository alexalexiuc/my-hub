import { formatMoney } from '@my-hub/shared/utils';
import { Card, SectionLabel, Pill } from '@/components';
import type { MonthlyReportData } from '@/app/api/finances/reports/monthly/route';

interface Props {
  report: MonthlyReportData['report'];
}

export function AccountFlowsTable({ report }: Props) {
  const { accounts } = report.accountFlows;

  if (accounts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Account flows</SectionLabel>
      <Card compact className="flex flex-col gap-0 divide-y divide-[var(--border)] p-0">
        {accounts.map(a => (
          <div key={a.accountId} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
                {a.accountName}
                {!a.reconciles && <Pill label="check balance" color="var(--red)" />}
              </div>
              <div className="text-[13px] font-bold" style={{ color: a.netDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {formatMoney(a.netDelta, a.currency, { signed: true })}
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-[var(--muted)]">
              <span>
                {formatMoney(a.openingBalance, a.currency)} → {formatMoney(a.closingBalance, a.currency)}
              </span>
              <span>
                <span style={{ color: 'var(--green)' }}>+{formatMoney(a.inflows, a.currency)}</span>{' '}
                <span style={{ color: 'var(--red)' }}>-{formatMoney(a.outflows, a.currency)}</span>
              </span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
