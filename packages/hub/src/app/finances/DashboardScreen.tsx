'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar, Divider, Sparkline, CategoryIcon } from './ui';
import { TransactionModal } from './transactions/TransactionModal';
import { TransactionList } from './transactions/TransactionList';
import type { FinanceDashboardData } from '@/app/api/finances/dashboard/route';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function currentMonthLabel() {
  return new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });
}

type DashboardScreenProps = {
  data: FinanceDashboardData;
  userName?: string;
};

export function DashboardScreen({ data, userName }: DashboardScreenProps) {
  const router = useRouter();
  const [showAddTx, setShowAddTx] = useState(false);
  const { currency, netWorth, netWorthHistory, monthlyIncome, monthlyExpense, categories, goals, recentTransactions } =
    data;

  const saved = monthlyIncome - monthlyExpense;
  const firstSnapshot = netWorthHistory[0];
  const nwChange = netWorthHistory.length >= 2 && firstSnapshot != null ? netWorth - firstSnapshot : null;

  return (
    <div className="flex flex-col gap-[14px]">
      {showAddTx && (
        <TransactionModal onCloseAction={() => setShowAddTx(false)} onSavedAction={() => setShowAddTx(false)} />
      )}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-0.5 text-xs text-[var(--fin-subtle)]">
            {getGreeting()}
            {userName ? `, ${userName}` : ''}
          </div>
          <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">{currentMonthLabel()}</div>
        </div>
      </div>

      {/* Net worth + cashflow row */}
      <div className="grid gap-2.5 md:grid-cols-2">
        <Card className="p-[14px]">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">Net Worth</div>
          <div className="mb-2 text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">
            {fmt(netWorth, currency)}
          </div>
          <Sparkline data={netWorthHistory} color={'var(--fin-green)'} width={90} height={28} />
          {nwChange !== null && (
            <div
              className={cn('mt-1 text-[10px]', nwChange >= 0 ? 'text-[var(--fin-green)]' : 'text-[var(--fin-red)]')}
            >
              {nwChange >= 0 ? '+' : '-'}
              {fmt(Math.abs(nwChange), currency)} this year
            </div>
          )}
        </Card>

        <Card className="p-[14px]">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">This Month</div>
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--fin-muted)]">Income</span>
              <span className="text-sm font-semibold text-[var(--fin-green)]">{fmt(monthlyIncome, currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--fin-muted)]">Expenses</span>
              <span className="text-sm font-semibold text-[var(--fin-red)]">{fmt(monthlyExpense, currency)}</span>
            </div>
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

      {/* Budget snapshot */}
      {categories.length > 0 && (
        <Card className="p-[14px]">
          <div className="mb-2.5 flex justify-between">
            <SectionLabel className="mb-0">Budget</SectionLabel>
            <span
              className="cursor-pointer text-[10px] text-[var(--fin-accent)]"
              onClick={() => router.push('/finances/categories')}
            >
              See all →
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {categories.map(cat => (
              <div key={cat.id}>
                <div className="mb-1 flex justify-between">
                  <div className="flex items-center gap-1.5">
                    <CategoryIcon color={cat.color} icon={cat.icon} size="sm" />
                    <span className="text-xs text-[var(--fin-text)]">{cat.name}</span>
                  </div>
                  <div className="text-[11px] text-[var(--fin-muted)]">
                    <span className={cat.spent >= cat.target ? 'text-[var(--fin-red)]' : 'text-[var(--fin-text)]'}>
                      {fmt(cat.spent, currency)}
                    </span>
                    <span className="text-[var(--fin-subtle)]"> / {fmt(cat.target, currency)}</span>
                  </div>
                </div>
                <Bar value={cat.spent} max={cat.target} color={cat.color ?? 'var(--fin-green)'} height={5} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <Card className="p-[14px]">
          <div className="mb-2.5 flex justify-between">
            <SectionLabel className="mb-0">Goals</SectionLabel>
            <span
              className="cursor-pointer text-[10px] text-[var(--fin-accent)]"
              onClick={() => router.push('/finances/goals')}
            >
              See all →
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {goals.slice(0, 4).map(g => {
              const pct = g.target > 0 ? Math.round((g.balance / g.target) * 100) : 0;
              return (
                <div key={g.id} className="rounded-lg px-3 py-2.5 bg-[var(--fin-card2)]">
                  <div className="mb-1 text-[11px] text-[var(--fin-muted)]">{g.name}</div>
                  <div className="text-[15px] font-bold text-[var(--fin-text)]">{fmt(g.balance, currency)}</div>
                  <div className="mb-1.5 text-[10px] text-[var(--fin-subtle)]">of {fmt(g.target, currency)}</div>
                  <Bar value={g.balance} max={g.target} color={'var(--fin-green)'} height={4} />
                  <div className="mt-1 text-[10px] text-[var(--fin-green)]">{pct}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent transactions */}
      <Card className="p-[14px]">
        <div className="mb-2.5 flex justify-between">
          <SectionLabel className="mb-0">Recent</SectionLabel>
          <span
            className="cursor-pointer text-[10px] text-[var(--fin-accent)]"
            onClick={() => router.push('/finances/transactions')}
          >
            All →
          </span>
        </div>

        <TransactionList transactions={recentTransactions} currency={currency} />
      </Card>
    </div>
  );
}
