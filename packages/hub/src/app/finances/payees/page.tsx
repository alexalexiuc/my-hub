'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/utils';
import type { PayeesResponse, PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { PayeesReportResponse, PayeeReportItem } from '@/app/api/finances/payees/report/route';
import { Card } from '../ui';
import { EditPayeeModal } from './EditPayeeModal';
import { MergePayeeModal } from './MergePayeeModal';
import { PayeesRangeFilter } from './PayeesRangeFilter';
import { PayeesTableHeader } from './PayeesTableHeader';
import { PayeeRow } from './PayeeRow';
import { PAYEE_RANGES, type Range, type SortKey } from './types';
import { Input } from '@/components';

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let hi = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return false;
    hi = found + 1;
  }
  return true;
}

function payeeMatchesSearch(payee: PayeeWithSuggestion, search: string): boolean {
  if (!search) return true;
  if (fuzzyMatch(payee.name, search)) return true;
  return payee.aliases.some(alias => fuzzyMatch(alias, search));
}

export default function PayeesPage() {
  const [range, setRange] = useState<Range>('30d');
  const [sortBy, setSortBy] = useState<SortKey>('totalSpent');
  const [search, setSearch] = useState('');
  const [reportData, setReportData] = useState<PayeesReportResponse | null>(null);
  const [allPayees, setAllPayees] = useState<PayeeWithSuggestion[]>([]);
  const [editingPayee, setEditingPayee] = useState<PayeeWithSuggestion | null>(null);
  const [mergingPayee, setMergingPayee] = useState<PayeeWithSuggestion | null>(null);
  const [payeesLoading, setPayeesLoading] = useState(true);

  const loadReport = useCallback(async (r: Range) => {
    const result = await apiFetch<PayeesReportResponse>(`/api/finances/payees/report?range=${r}`, {
      silentToast: true,
    });
    setReportData(result);
  }, []);

  const loadPayees = useCallback(async () => {
    setPayeesLoading(true);
    try {
      const result = await apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true });
      setAllPayees(result.payees);
    } finally {
      setPayeesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(range);
  }, [range, loadReport]);

  useEffect(() => {
    loadPayees();
  }, [loadPayees]);

  const currency = reportData?.currency ?? 'EUR';
  const reportById = useMemo<Map<number, PayeeReportItem>>(() => {
    return new Map((reportData?.payees ?? []).map(p => [p.id, p]));
  }, [reportData]);

  const sorted = useMemo(() => {
    const filtered = allPayees.filter(p => payeeMatchesSearch(p, search));
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const ra = reportById.get(a.id);
      const rb = reportById.get(b.id);
      if (sortBy === 'totalSpent') return (rb?.totalSpent ?? 0) - (ra?.totalSpent ?? 0);
      if (sortBy === 'txCount') return (rb?.txCount ?? 0) - (ra?.txCount ?? 0);
      return 0;
    });
  }, [allPayees, search, sortBy, reportById]);

  const loading = payeesLoading;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Payees</div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search payees…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <PayeesRangeFilter range={range} onChange={setRange} ranges={PAYEE_RANGES} />
      </div>

      {loading ? (
        <div
          className="h-[300px] rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
          style={{ opacity: 0.6 }}
        />
      ) : (
        <Card className="p-0">
          <PayeesTableHeader sortBy={sortBy} onSort={setSortBy} />

          {sorted.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--fin-subtle)]">
              {search ? 'No payees match your search' : 'No payees yet'}
            </div>
          )}

          {sorted.map((p, i) => (
            <PayeeRow
              key={p.id}
              payee={p}
              reportItem={reportById.get(p.id)}
              currency={currency}
              showDivider={i > 0}
              onEdit={setEditingPayee}
              onMerge={setMergingPayee}
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
            await Promise.all([loadPayees(), loadReport(range)]);
          }}
        />
      )}

      {mergingPayee && (
        <MergePayeeModal
          payee={mergingPayee}
          allPayees={allPayees}
          onClose={() => setMergingPayee(null)}
          onMerged={async () => {
            setMergingPayee(null);
            await Promise.all([loadPayees(), loadReport(range)]);
          }}
        />
      )}
    </div>
  );
}
