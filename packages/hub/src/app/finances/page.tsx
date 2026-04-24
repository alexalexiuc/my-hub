'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/utils';
import { DashboardScreen } from './DashboardScreen';
import { CreateBudgetScreen } from './CreateBudgetScreen';
import { T } from './ui';
import type { DashboardResponse, FinanceDashboardData } from './types';

export default function FinancesPage() {
  const { data: session } = useSession();
  const [response, setResponse] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<DashboardResponse>('/api/finances/dashboard', {
        silentToast: true,
      });
      setResponse(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[140, 100, 180, 160].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              borderRadius: 10,
              background: T.card,
              border: `1px solid ${T.border}`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    );
  }

  if (!response || !response.hasBudget) {
    return <CreateBudgetScreen onCreated={load} />;
  }

  const data = response as FinanceDashboardData;
  const firstName = session?.user?.name?.split(' ')[0];

  return <DashboardScreen data={data} userName={firstName} />;
}
