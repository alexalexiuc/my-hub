import { Card, SectionLabel, SubText } from '@/components';
import { fmt, fmtSign } from '../../ui';
import type { YearlyReportData } from '@/app/api/finances/reports/yearly/route';

interface Props {
  report: YearlyReportData['report'];
  currency: string;
}

export function NetWorthAndSavings({ report, currency }: Props) {
  const { netWorthHistory, netWorthDelta, savingsContributions, ibkrDca } = report;
  const deltaColor = (netWorthDelta ?? 0) >= 0 ? 'var(--green)' : 'var(--red)';
  const totalColor = savingsContributions.totalNetContribution >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <SectionLabel>Net worth trajectory</SectionLabel>
        <Card compact className="p-4">
          {netWorthHistory.length === 0 ? (
            <div className="text-[12px] text-[var(--subtle)]">
              No monthly net worth snapshots recorded for this year yet.
            </div>
          ) : (
            <>
              {netWorthDelta != null && (
                <>
                  <SubText>Start-of-year to end-of-year</SubText>
                  <div className="mb-3 text-[22px] font-bold" style={{ color: deltaColor }}>
                    {fmtSign(netWorthDelta, currency)}
                  </div>
                </>
              )}
              <div className="flex flex-col gap-1.5">
                {netWorthHistory.map(h => (
                  <div key={h.month} className="flex justify-between text-[12px]">
                    <span className="text-[var(--muted)]">{h.month}</span>
                    <span className="font-medium text-[var(--text)]">{fmt(h.netWorth, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Savings &amp; investment contribution</SectionLabel>
        <Card compact className="p-4">
          <SubText>Net contribution this year</SubText>
          <div className="mt-1 text-[24px] font-bold" style={{ color: totalColor }}>
            {fmtSign(savingsContributions.totalNetContribution, currency)}
          </div>
          {savingsContributions.accounts.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
              {savingsContributions.accounts.map(a => (
                <div key={a.accountId} className="flex justify-between text-[12px]">
                  <span className="text-[var(--text)]">{a.accountName}</span>
                  <span className="font-medium text-[var(--text)]">{fmtSign(a.netContribution, a.currency)}</span>
                </div>
              ))}
            </div>
          )}
          {ibkrDca && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <SubText>Portfolio DCA vs target</SubText>
              <div className="mt-1 text-[14px] font-semibold text-[var(--text)]">
                {fmt(ibkrDca.actualContributed, ibkrDca.currency)} / {fmt(ibkrDca.targetContribution, ibkrDca.currency)}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
