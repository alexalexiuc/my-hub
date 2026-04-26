'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, Bar } from '../ui';
import { AddTransactionModal } from '../transactions/AddTransactionModal';
import { AddGoalModal } from './AddGoalModal';
import type { GoalItem } from '@/app/api/finances/goals/route';

interface GoalsData {
  currency: string;
  goals: GoalItem[];
}

function projectedDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleString('en-IE', { month: 'short', year: 'numeric' });
}

export default function GoalsPage() {
  const router = useRouter();
  const [data, setData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<GoalsData>('/api/finances/goals', { silentToast: true });
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[80, 160, 160].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { currency, goals } = data;
  const totalSaved = goals.reduce((s, g) => s + g.balance, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {showAddTx && <AddTransactionModal onClose={() => setShowAddTx(false)} onCreated={() => setShowAddTx(false)} />}
      {showAddGoal && (
        <AddGoalModal
          defaultCurrency={currency}
          onClose={() => setShowAddGoal(false)}
          onCreated={() => {
            setShowAddGoal(false);
            load();
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Goals</div>
        <button
          onClick={() => {
            /* TODO: add goal form */
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 11,
            background: T.card2,
            border: `1px solid ${T.border}`,
            color: T.muted,
            cursor: 'pointer',
          }}
        >
          + New Goal
        </button>
      </div>

      {/* Summary banner */}
      {goals.length > 0 && (
        <div
          style={{
            background: `linear-gradient(135deg, ${T.green}18, ${T.card})`,
            border: `1px solid ${T.green}33`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Total saved across all goals</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            {fmt(totalSaved, currency)}
          </div>
          <Bar value={totalSaved} max={totalTarget} color={T.green} height={6} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 11, color: T.muted }}>
            {fmt(totalSaved, currency)} of {fmt(totalTarget, currency)} · {overallPct}% overall
          </div>
        </div>
      )}

      {/* Goal cards */}
      {goals.map(g => {
        const pct = g.targetAmount > 0 ? Math.round((g.balance / g.targetAmount) * 100) : 0;
        return (
          <Card
            key={g.id}
            onClick={() => router.push(`/finances/accounts/${g.id}`)}
            style={{ padding: 16, cursor: 'pointer' }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 3 }}>{g.name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{fmt(g.balance, g.currency)}</span>
                  <span style={{ fontSize: 11, color: T.subtle }}>of {fmt(g.targetAmount, g.currency)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.green }}>{pct}%</div>
                {g.projectedMonths != null && (
                  <div style={{ fontSize: 10, color: T.subtle, marginTop: 2 }}>~{projectedDate(g.projectedMonths)}</div>
                )}
              </div>
            </div>

            <Bar value={g.balance} max={g.targetAmount} color={T.green} height={8} style={{ marginBottom: 10 }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowAddTx(true);
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  background: T.green + '22',
                  border: `1px solid ${T.green}44`,
                  color: T.green,
                  cursor: 'pointer',
                }}
              >
                + Add Funds
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  router.push(`/finances/accounts/${g.id}`);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  background: T.card2,
                  border: `1px solid ${T.border}`,
                  color: T.muted,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
            </div>
          </Card>
        );
      })}

      {goals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.subtle, fontSize: 13 }}>
          No goals yet. Create a goal account to start saving.
        </div>
      )}
    </div>
  );
}
