'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { T, fmt, Card, SectionLabel, Bar, Divider, Sparkline, CategoryIcon } from './ui';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {showAddTx && <AddTransactionModal onClose={() => setShowAddTx(false)} onCreated={() => setShowAddTx(false)} />}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: T.subtle, marginBottom: 2 }}>
            {getGreeting()}
            {userName ? `, ${userName}` : ''}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>
            {currentMonthLabel()}
          </div>
        </div>
        <button
          onClick={() => setShowAddTx(true)}
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 11,
            background: T.accentD,
            border: `1px solid ${T.accent}44`,
            color: T.accent,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </div>

      {/* Net worth + cashflow row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10,
              color: T.subtle,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 6,
            }}
          >
            Net Worth
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-.02em', marginBottom: 8 }}>
            {fmt(netWorth, currency)}
          </div>
          <Sparkline data={netWorthHistory} color={T.green} width={90} height={28} />
          {nwChange !== null && (
            <div style={{ fontSize: 10, color: nwChange >= 0 ? T.green : T.red, marginTop: 4 }}>
              {nwChange >= 0 ? '+' : '-'}
              {fmt(Math.abs(nwChange), currency)} this year
            </div>
          )}
        </Card>

        <Card style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10,
              color: T.subtle,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 6,
            }}
          >
            This Month
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: T.muted }}>Income</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.green }}>{fmt(monthlyIncome, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: T.muted }}>Expenses</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.red }}>{fmt(monthlyExpense, currency)}</span>
            </div>
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: T.muted }}>Saved</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: saved >= 0 ? T.accent : T.red }}>
                {fmt(saved, currency)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Budget snapshot */}
      {categories.length > 0 && (
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Budget</SectionLabel>
            <span
              style={{ fontSize: 10, color: T.accent, cursor: 'pointer' }}
              onClick={() => router.push('/finances/categories')}
            >
              See all →
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {categories.map(cat => (
              <div key={cat.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CategoryIcon color={cat.color} icon={cat.icon} size="sm" />
                    <span style={{ fontSize: 12, color: T.text }}>{cat.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    <span style={{ color: cat.spent >= cat.target ? T.red : T.text }}>{fmt(cat.spent, currency)}</span>
                    <span style={{ color: T.subtle }}> / {fmt(cat.target, currency)}</span>
                  </div>
                </div>
                <Bar value={cat.spent} max={cat.target} color={cat.color ?? T.green} height={5} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Goals</SectionLabel>
            <span
              style={{ fontSize: 10, color: T.accent, cursor: 'pointer' }}
              onClick={() => router.push('/finances/goals')}
            >
              See all →
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {goals.slice(0, 4).map(g => {
              const pct = g.target > 0 ? Math.round((g.balance / g.target) * 100) : 0;
              return (
                <div key={g.id} style={{ background: T.card2, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{g.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{fmt(g.balance, currency)}</div>
                  <div style={{ fontSize: 10, color: T.subtle, marginBottom: 6 }}>of {fmt(g.target, currency)}</div>
                  <Bar value={g.balance} max={g.target} color={T.green} height={4} />
                  <div style={{ fontSize: 10, color: T.green, marginTop: 4 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent transactions */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <SectionLabel style={{ marginBottom: 0 }}>Recent</SectionLabel>
          <span
            style={{ fontSize: 10, color: T.accent, cursor: 'pointer' }}
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
