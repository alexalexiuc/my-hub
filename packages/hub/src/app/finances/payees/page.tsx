'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import type { PayeesResponse, PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { PayeesReportResponse } from '@/app/api/finances/payees/report/route';
import { Card } from '../ui';
import { EditPayeeModal } from './EditPayeeModal';
import { PayeesRangeFilter } from './PayeesRangeFilter';
import { PayeesTableHeader } from './PayeesTableHeader';
import { PayeeRow } from './PayeeRow';
import { PAYEE_RANGES, type Range, type SortKey } from './types';

export default function PayeesPage() {
  const [range, setRange] = useState<Range>('30d');
  const [sortBy, setSortBy] = useState<SortKey>('totalSpent');
  const [data, setData] = useState<PayeesReportResponse | null>(null);
  const [payeesById, setPayeesById] = useState<Map<number, PayeeWithSuggestion>>(new Map());
  const [editingPayee, setEditingPayee] = useState<PayeeWithSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const result = await apiFetch<PayeesReportResponse>(`/api/finances/payees/report?range=${r}`, {
        silentToast: true,
      });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPayees = useCallback(async () => {
    const result = await apiFetch<PayeesResponse>('/api/finances/payees', {
      silentToast: true,
    });
    setPayeesById(new Map(result.payees.map(payee => [payee.id, payee])));
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  useEffect(() => {
    loadPayees();
  }, [loadPayees]);

  // TODO: Get currency from budget
  const currency = data?.currency ?? 'EUR';
  const sorted = [...(data?.payees ?? [])].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return b[sortBy] - a[sortBy];
  });

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Payees</div>

      <PayeesRangeFilter range={range} onChange={setRange} ranges={PAYEE_RANGES} />

      {loading ? (
        <div
          className="h-[300px] rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
          style={{ opacity: 0.6 }}
        />
      ) : (
        <Card className="p-0">
          <PayeesTableHeader sortBy={sortBy} onSort={setSortBy} />

          {sorted.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--fin-subtle)]">No payee data for this period</div>
          )}

          {sorted.map((p, i) => (
            <PayeeRow
              key={p.id}
              payee={p}
              fullPayee={payeesById.get(p.id)}
              currency={currency}
              showDivider={i > 0}
              onEdit={setEditingPayee}
            />
          ))}
        </Card>
      )}

      {editingPayee && (
        <EditPayeeModal
          payee={editingPayee}
          onClose={() => setEditingPayee(null)}
          onSaved={async () => {
            setEditingPayee(null);
            await Promise.all([loadPayees(), load(range)]);
          }}
        />
      )}
    </div>
  );
}
