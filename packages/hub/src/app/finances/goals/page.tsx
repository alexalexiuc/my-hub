'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, Bar, SubText } from '../ui';
import { TransactionModal } from '../transactions/TransactionModal';
import { AddGoalModal } from './AddGoalModal';
import type { GoalsResponse } from '@/app/api/finances/goals/route';

function projectedDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleString('en-IE', { month: 'short', year: 'numeric' });
}

export default function GoalsPage() {
  const router = useRouter();
  const [data, setData] = useState<GoalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [addFundsGoal, setAddFundsGoal] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<GoalsResponse>('/api/finances/goals', { silentToast: true });
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[80, 160, 160].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
            style={{ height: h, opacity: 0.6 }}
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
    <div className="flex flex-col gap-[14px]">
      {addFundsGoal && (
        <TransactionModal
          onCloseAction={() => setAddFundsGoal(null)}
          onSavedAction={() => setAddFundsGoal(null)}
          initialType="transfer"
          lockedType
          prefilledToAccountId={addFundsGoal.id}
          prefilledToAccountName={addFundsGoal.name}
        />
      )}
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
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Goals</div>
        <button
          onClick={() => setShowAddGoal(true)}
          className="cursor-pointer rounded-[20px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-1.5 text-[11px] text-[var(--fin-muted)]"
        >
          + New Goal
        </button>
      </div>

      {/* Summary banner */}
      {goals.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: `linear-gradient(135deg, var(--fin-green)18, var(--fin-card))`,
            border: `1px solid var(--fin-green)33`,
          }}
        >
          <div className="mb-1 text-[11px] text-[var(--fin-muted)]">Total saved across all goals</div>
          <div className="mb-1.5 text-[26px] font-bold text-[var(--fin-text)]">{fmt(totalSaved, currency)}</div>
          <Bar value={totalSaved} max={totalTarget} color={'var(--fin-green)'} height={6} className="mb-1.5" />
          <div className="text-[11px] text-[var(--fin-muted)]">
            {fmt(totalSaved, currency)} of {fmt(totalTarget, currency)} · {overallPct}% overall
          </div>
        </div>
      )}

      {/* Goal cards */}
      {goals.map(g => {
        const pct = g.targetAmount > 0 ? Math.round((g.balance / g.targetAmount) * 100) : 0;
        return (
          <Card key={g.id} onClick={() => router.push(`/finances/goals/${g.id}`)} className="cursor-pointer p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="mb-[3px] text-[15px] font-semibold text-[var(--fin-text)]">{g.name}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[var(--fin-text)]">{fmt(g.balance, g.currency)}</span>
                  <SubText>of {fmt(g.targetAmount, g.currency)}</SubText>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-[var(--fin-green)]">{pct}%</div>
                {g.projectedMonths != null && (
                  <SubText className="block mt-0.5">~{projectedDate(g.projectedMonths)}</SubText>
                )}
              </div>
            </div>

            <Bar value={g.balance} max={g.targetAmount} color={'var(--fin-green)'} height={8} className="mb-2.5" />

            <div className="flex gap-2">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setAddFundsGoal({ id: g.id, name: g.name });
                }}
                className="flex-1 cursor-pointer rounded-lg border py-2 text-xs font-semibold text-[var(--fin-green)]"
                style={{
                  background: 'var(--fin-green)22',
                  border: `1px solid var(--fin-green)44`,
                }}
              >
                + Add Funds
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  router.push(`/finances/goals/${g.id}`);
                }}
                className="cursor-pointer rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-[14px] py-2 text-xs text-[var(--fin-muted)]"
              >
                Edit
              </button>
            </div>
          </Card>
        );
      })}

      {goals.length === 0 && (
        <div className="py-12 text-center text-[13px] text-[var(--fin-subtle)]">
          No goals yet. Create a goal account to start saving.
        </div>
      )}
    </div>
  );
}
