import { Card, SectionLabel, SubText } from '@/components';
import { fmt, fmtSign } from '../../ui';
import type { YearlyReportData } from '@/app/api/finances/reports/yearly/route';

const TOP_CATEGORIES = 8;

interface Props {
  report: YearlyReportData['report'];
  currency: string;
}

export function LoansAndCategories({ report, currency }: Props) {
  const { loans, categoryByMonth, yearOverYear, year } = report;

  const topCategories = categoryByMonth
    .map(c => ({ ...c, total: Object.values(c.months).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_CATEGORIES);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  const yoyMovers = yearOverYear.groups.filter(g => g.absoluteDelta !== 0).slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <SectionLabel>Loan payoff progress</SectionLabel>
        <Card compact className="p-4">
          {loans.length === 0 ? (
            <div className="text-[12px] text-[var(--subtle)]">No loan accounts.</div>
          ) : (
            loans.map(l => (
              <div
                key={l.accountId}
                className="flex justify-between border-b border-[var(--border)] py-2 text-[12px] last:border-none"
              >
                <span className="text-[var(--text)]">{l.accountName}</span>
                <span style={{ color: 'var(--green)' }}>
                  {fmtSign(l.paidDownThisYear, l.currency)} paid down, {fmt(l.remainingBalance, l.currency)} left
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Category spend by month (top {topCategories.length || 0})</SectionLabel>
        <Card compact className="overflow-x-auto p-4">
          {topCategories.length === 0 ? (
            <div className="text-[12px] text-[var(--subtle)]">No categorized expenses this year.</div>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="pb-2 text-left text-[var(--muted)]">Category</th>
                  {months.map(m => (
                    <th key={m} className="pb-2 pl-2 text-right text-[var(--muted)]">
                      {m.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCategories.map(c => (
                  <tr key={c.categoryId ?? c.categoryName} className="border-t border-[var(--border)]">
                    <td className="py-1.5 text-[var(--text)]">{c.categoryName}</td>
                    {months.map(m => (
                      <td key={m} className="py-1.5 pl-2 text-right text-[var(--muted)]">
                        {Math.round(c.months[m] ?? 0).toLocaleString('en-US')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Year-over-year (biggest movers)</SectionLabel>
        <Card compact className="p-4">
          {yoyMovers.length === 0 ? (
            <SubText>Not enough history for a year-over-year comparison yet.</SubText>
          ) : (
            yoyMovers.map(g => (
              <div
                key={g.id ?? g.key}
                className="flex justify-between border-b border-[var(--border)] py-2 text-[12px] last:border-none"
              >
                <span className="text-[var(--text)]">{g.key}</span>
                <span style={{ color: g.absoluteDelta >= 0 ? 'var(--red)' : 'var(--green)' }}>
                  {fmtSign(g.absoluteDelta, currency)}
                  {g.percentDelta != null ? ` (${g.percentDelta >= 0 ? '+' : ''}${g.percentDelta}%)` : ''}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
