'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/utils';
import { dateToString } from '@my-hub/shared/utils';
import { DashboardScreen } from './DashboardScreen';
import { CreateBudgetScreen } from './CreateBudgetScreen';
import { BudgetSelectorScreen } from './BudgetSelectorScreen';
import type { DashboardResponse, NoBudgetResponse } from '@/app/api/finances/dashboard/route';
import { useUserNameFromSession } from '@/hooks/useUserNameFromSession';
import { transactionEvents } from './transactions/transactionEvents';

const CURRENT_MONTH = dateToString(new Date(), 'YYYY-MM');

export default function FinancesPage() {
  const [response, setResponse] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  // Tracks the latest load invocation so stale responses (e.g. from React Strict
  // Mode's second effect run) do not overwrite a fresher result.
  const loadIdRef = useRef(0);
  const { firstName } = useUserNameFromSession();

  const load = useCallback(async (month: string) => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    try {
      const result = await apiFetch<DashboardResponse>(`/api/finances/dashboard?month=${month}`, {
        silentToast: true,
      });
      if (loadId !== loadIdRef.current) return;
      setResponse(result);
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    load(selectedMonth);

    const handler = () => load(selectedMonth);
    transactionEvents.on('changed', handler);
    return () => transactionEvents.off('changed', handler);
  }, [selectedMonth, load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[140, 100, 180, 160].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              background: 'var(--fin-card)',
              borderColor: 'var(--fin-border)',
              opacity: 0.6,
            }}
            className="rounded-[10px] border"
          />
        ))}
      </div>
    );
  }

  if (!response || !response.hasBudget) {
    const noBudget = response as NoBudgetResponse | null;
    const available = noBudget?.availableBudgets ?? [];

    if (!showCreate && available.length > 0) {
      return (
        <BudgetSelectorScreen
          budgets={available}
          onActivated={() => {
            setShowCreate(false);
            void load(selectedMonth);
          }}
          onCreateNew={() => setShowCreate(true)}
        />
      );
    }

    return (
      <CreateBudgetScreen
        onCreated={() => {
          setShowCreate(false);
          void load(selectedMonth);
        }}
      />
    );
  }

  return (
    <DashboardScreen
      data={response}
      userName={firstName}
      selectedMonth={selectedMonth}
      currentMonth={CURRENT_MONTH}
      onMonthChange={setSelectedMonth}
    />
  );
}
