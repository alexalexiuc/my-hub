'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmt, Card, SectionLabel, Bar, Divider, Sparkline, CategoryIcon } from './ui';
import { AddTransactionModal } from './transactions/AddTransactionModal';
import { TransactionList } from './transactions/TransactionList';
import type { FinanceDashboardData } from './types';

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
      {showAddTx && <AddTransactionModal onClose={() => setShowAddTx(false)} onCreated={() => setShowAddTx(false)} />}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-0.5 text-xs" style={{ color: 'var(--fin-subtle)' }}>
            {getGreeting()}
            {userName ? `, ${userName}` : ''}
          </div>
          <div className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fin-text)' }}>
            {currentMonthLabel()}
          </div>
        </div>
        <button
          onClick={() => setShowAddTx(true)}
          className="cursor-pointer rounded-[20px] border px-3 py-1.5 text-[11px] font-semibold"
          style={{
            background: 'var(--fin-accent-d)',
            border: `1px solid ${'var(--fin-accent)'}44`,
            color: 'var(--fin-accent)',
          }}
        >
          + Add
        </button>
      </div>

      {/* Net worth + cashflow row */}
      <div className="grid gap-2.5 md:grid-cols-2">
        <Card className="p-[14px]">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--fin-subtle)' }}>
            Net Worth
          </div>
          <div className="mb-2 text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fin-text)' }}>
            {fmt(netWorth, currency)}
          </div>
          <Sparkline data={netWorthHistory} color={'var(--fin-green)'} width={90} height={28} />
          {nwChange !== null && (
            <div className="mt-1 text-[10px]" style={{ color: nwChange >= 0 ? 'var(--fin-green)' : 'var(--fin-red)' }}>
              {nwChange >= 0 ? '+' : '-'}
              {fmt(Math.abs(nwChange), currency)} this year
            </div>
          )}
        </Card>

        <Card className="p-[14px]">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--fin-subtle)' }}>
            This Month
          </div>
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: 'var(--fin-muted)' }}>
                Income
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--fin-green)' }}>
                {fmt(monthlyIncome, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: 'var(--fin-muted)' }}>
                Expenses
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--fin-red)' }}>
                {fmt(monthlyExpense, currency)}
              </span>
            </div>
            <Divider />
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: 'var(--fin-muted)' }}>
                Saved
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: saved >= 0 ? 'var(--fin-accent)' : 'var(--fin-red)' }}
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
            <SectionLabel style={{ marginBottom: 0 }}>Budget</SectionLabel>
            <span
              className="cursor-pointer text-[10px]"
              style={{ color: 'var(--fin-accent)' }}
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
                    <span className="text-xs" style={{ color: 'var(--fin-text)' }}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--fin-muted)' }}>
                    <span style={{ color: cat.spent >= cat.target ? 'var(--fin-red)' : 'var(--fin-text)' }}>
                      {fmt(cat.spent, currency)}
                    </span>
                    <span style={{ color: 'var(--fin-subtle)' }}> / {fmt(cat.target, currency)}</span>
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
            <SectionLabel style={{ marginBottom: 0 }}>Goals</SectionLabel>
            <span
              className="cursor-pointer text-[10px]"
              style={{ color: 'var(--fin-accent)' }}
              onClick={() => router.push('/finances/goals')}
            >
              See all →
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {goals.slice(0, 4).map(g => {
              const pct = g.target > 0 ? Math.round((g.balance / g.target) * 100) : 0;
              return (
                <div key={g.id} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--fin-card2)' }}>
                  <div className="mb-1 text-[11px]" style={{ color: 'var(--fin-muted)' }}>
                    {g.name}
                  </div>
                  <div className="text-[15px] font-bold" style={{ color: 'var(--fin-text)' }}>
                    {fmt(g.balance, currency)}
                  </div>
                  <div className="mb-1.5 text-[10px]" style={{ color: 'var(--fin-subtle)' }}>
                    of {fmt(g.target, currency)}
                  </div>
                  <Bar value={g.balance} max={g.target} color={'var(--fin-green)'} height={4} />
                  <div className="mt-1 text-[10px]" style={{ color: 'var(--fin-green)' }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent transactions */}
      <Card className="p-[14px]">
        <div className="mb-2.5 flex justify-between">
          <SectionLabel style={{ marginBottom: 0 }}>Recent</SectionLabel>
          <span
            className="cursor-pointer text-[10px]"
            style={{ color: 'var(--fin-accent)' }}
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
