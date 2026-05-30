import { cn } from '@/lib/utils';
import { formatMonthStr, shiftMonthStr } from '@my-hub/shared/utils';
import { fmt, Card, SectionLabel, Bar, Divider, SubText, SmartDatePicker, SeeAllButton } from './ui';
import { CategoryPieChart, SpendingTrendChart } from './DashboardCharts';
import { TransactionList } from './transactions/TransactionList';
import type { FinanceDashboardData } from '@/app/api/finances/dashboard/route';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type DashboardScreenProps = {
  data: FinanceDashboardData;
  userName?: string;
  selectedMonth: string;
  currentMonth: string;
  onMonthChange: (month: string) => void;
};

export function DashboardScreen({ data, userName, selectedMonth, currentMonth, onMonthChange }: DashboardScreenProps) {
  const {
    currency,
    availableBalance,
    monthlyIncome,
    monthlyExpense,
    monthlyTransfers,
    categories,
    dailySpending,
    goals,
  } = data;

  const saved = monthlyIncome - monthlyExpense - monthlyTransfers;
  const monthLabel = selectedMonth === currentMonth ? 'This month' : formatMonthStr(selectedMonth);

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Header */}
      <div>
        <div className="mb-1 text-xs text-[var(--fin-subtle)]">
          {getGreeting()}
          {userName ? `, ${userName}` : ''}
        </div>
        <SmartDatePicker
          month={selectedMonth}
          onChange={patch => patch.month && onMonthChange(patch.month)}
          currentMonth={currentMonth}
          maxMonth={currentMonth}
        />
      </div>

      {/* Available balance + cashflow row */}
      <div className="grid gap-2.5 md:grid-cols-2">
        <Card className="p-[14px]">
          <SubText className="block mb-1.5 uppercase tracking-[0.08em]">Available</SubText>
          <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">
            {fmt(availableBalance, currency)}
          </div>
        </Card>

        <Card className="p-[14px]">
          <SubText className="block mb-1.5 uppercase tracking-[0.08em]">
            {selectedMonth === currentMonth ? 'This Month' : formatMonthStr(selectedMonth)}
          </SubText>
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--fin-muted)]">Income</span>
              <span className="text-sm font-semibold text-[var(--fin-green)]">{fmt(monthlyIncome, currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--fin-muted)]">Expenses</span>
              <span className="text-sm font-semibold text-[var(--fin-red)]">{fmt(monthlyExpense, currency)}</span>
            </div>
            {monthlyTransfers > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--fin-muted)]">Loan repayments</span>
                <span className="text-sm font-semibold text-[var(--fin-red)]">{fmt(monthlyTransfers, currency)}</span>
              </div>
            )}
            <Divider />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--fin-muted)]">Saved</span>
              <span
                className={cn('text-sm font-bold', saved >= 0 ? 'text-[var(--fin-accent)]' : 'text-[var(--fin-red)]')}
              >
                {fmt(saved, currency)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Spending charts row */}
      {(categories.length > 0 || dailySpending.length > 0) && (
        <div className="grid gap-2.5 md:grid-cols-2">
          {categories.length > 0 && (
            <Card className="p-[14px]">
              <div className="mb-2 flex justify-between">
                <SectionLabel className="mb-0">By Category</SectionLabel>
                <SeeAllButton href="/finances/categories" />
              </div>
              <CategoryPieChart categories={categories} currency={currency} />
            </Card>
          )}
          {dailySpending.length > 0 && (
            <Card className="p-[14px]">
              <div className="mb-2 flex justify-between">
                <SectionLabel className="mb-0">Spending</SectionLabel>
                <div className="flex items-center gap-2 text-[9px] text-[var(--fin-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-[2px] w-4 bg-[var(--fin-accent)]" />
                    {monthLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-[2px] w-4 border-t border-dashed border-[var(--fin-subtle)]" />
                    {formatMonthStr(shiftMonthStr(selectedMonth, -1))}
                  </span>
                </div>
              </div>
              <div className="h-[200px]">
                <SpendingTrendChart
                  dailySpending={dailySpending}
                  currency={currency}
                  monthLabel={monthLabel}
                  prevLabel={formatMonthStr(shiftMonthStr(selectedMonth, -1))}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <Card className="p-[14px]">
          <div className="mb-2.5 flex justify-between">
            <SectionLabel className="mb-0">Goals</SectionLabel>
            <SeeAllButton href="/finances/goals" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {goals.slice(0, 4).map(g => {
              const pct = g.target > 0 ? Math.round((g.balance / g.target) * 100) : 0;
              return (
                <div key={g.id} className="rounded-lg px-3 py-2.5 bg-[var(--fin-card2)]">
                  <div className="mb-1 text-[11px] text-[var(--fin-muted)]">{g.name}</div>
                  <div className="text-[15px] font-bold text-[var(--fin-text)]">{fmt(g.balance, currency)}</div>
                  <SubText className="block mb-1.5">of {fmt(g.target, currency)}</SubText>
                  <Bar value={g.balance} max={g.target} color={'var(--fin-green)'} height={4} />
                  <div className="mt-1 text-[10px] text-[var(--fin-green)]">{pct}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent transactions */}
      <Card className="p-0 md:p-[14px]">
        <div className="mb-2.5 flex justify-between px-[14px] pt-[14px] md:px-0 md:pt-0">
          <SectionLabel className="mb-0">Recent</SectionLabel>
          <SeeAllButton href="/finances/transactions" />
        </div>

        <TransactionList limit={5} month={selectedMonth} />
      </Card>
    </div>
  );
}
