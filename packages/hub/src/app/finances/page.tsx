'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/utils';
import { DashboardScreen } from './DashboardScreen';
import { CreateBudgetScreen } from './CreateBudgetScreen';
import { BudgetSelectorScreen } from './BudgetSelectorScreen';
import type { DashboardResponse, FinanceDashboardData, NoBudgetResponse } from './types';

export default function FinancesPage() {
  const { data: session } = useSession();
  const [response, setResponse] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  // Tracks the latest load invocation so stale responses (e.g. from React Strict
  // Mode's second effect run) do not overwrite a fresher result.
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    try {
      const result = await apiFetch<DashboardResponse>('/api/finances/dashboard', {
        silentToast: true,
      });
      if (loadId !== loadIdRef.current) return;
      setResponse(result);
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
            void load();
          }}
          onCreateNew={() => setShowCreate(true)}
        />
      );
    }

    return (
      <CreateBudgetScreen
        onCreated={() => {
          setShowCreate(false);
          void load();
        }}
      />
    );
  }

  const data = response as FinanceDashboardData;
  const firstName = session?.user?.name?.split(' ')[0];

  return <DashboardScreen data={data} userName={firstName} />;
}
