import { Card, SectionLabel, SubText, ProgressBar } from '@/components';
import { fmt, fmtSign } from '../../ui';
import type { MonthlyReportData } from '@/app/api/finances/reports/monthly/route';

interface Props {
  report: MonthlyReportData['report'];
  currency: string;
}

export function SavingsAndBudget({ report, currency }: Props) {
  const { savingsContributions, budgetProgress } = report;
  const delta =
    savingsContributions.totalNetContribution.amount - savingsContributions.previousPeriod.totalNetContribution.amount;
  const totalColor = savingsContributions.totalNetContribution.amount >= 0 ? 'var(--green)' : 'var(--red)';
  const targetedCategories = budgetProgress.categories.filter(c => c.monthlyTarget != null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <SectionLabel>Savings &amp; investment contribution</SectionLabel>
        <Card compact className="p-4">
          <SubText>Net contribution this month</SubText>
          <div className="mt-1 text-[24px] font-bold" style={{ color: totalColor }}>
            {fmtSign(
              savingsContributions.totalNetContribution.amount,
              savingsContributions.totalNetContribution.currency,
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--muted)]">
            {fmtSign(delta, savingsContributions.totalNetContribution.currency)} vs prior month
          </div>
          {savingsContributions.accounts.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
              {savingsContributions.accounts.map(a => (
                <div key={a.accountId} className="flex justify-between text-[12px]">
                  <span className="text-[var(--text)]">{a.accountName}</span>
                  <span className="font-medium text-[var(--text)]">
                    {fmtSign(a.converted.amount, a.converted.currency)}
                    {a.original.currency !== a.converted.currency && (
                      <span className="ml-1 font-normal text-[var(--muted)]">
                        ({fmtSign(a.original.amount, a.original.currency)})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Budget vs target</SectionLabel>
        <Card compact className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <SubText>Total</SubText>
            <span className="text-[13px] font-semibold text-[var(--text)]">
              {fmt(budgetProgress.totalSpent, currency)} / {fmt(budgetProgress.totalBudgeted, currency)}
            </span>
          </div>
          {targetedCategories.length === 0 && (
            <div className="text-[12px] text-[var(--subtle)]">No categories with a monthly target.</div>
          )}
          {targetedCategories.map(c => (
            <div key={c.id} className="mb-2 last:mb-0">
              <div className="mb-1 flex justify-between text-[12px]">
                <span className="text-[var(--text)]">{c.displayName}</span>
                <span className="text-[var(--muted)]">
                  {fmt(c.spent, currency)} / {fmt(c.monthlyTarget ?? 0, currency)}
                </span>
              </div>
              <ProgressBar value={c.spent} max={c.monthlyTarget ?? 0} height={5} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
