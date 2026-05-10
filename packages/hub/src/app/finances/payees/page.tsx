'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, Divider, CategoryIcon } from '../ui';
import { PencilIcon } from '@/components/icons';
import { EditPayeeModal } from './EditPayeeModal';
import type { PayeesReportResponse, PayeesResponse, PayeeSuggestion } from '@/app/api/finances/contracts';
type Range = '30d' | '3m' | 'ytd';
type SortKey = 'totalSpent' | 'txCount' | 'name';

const RANGES: { key: Range; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'ytd', label: 'This year' },
];

export default function PayeesPage() {
  const [range, setRange] = useState<Range>('30d');
  const [sortBy, setSortBy] = useState<SortKey>('totalSpent');
  const [data, setData] = useState<PayeesReportResponse | null>(null);
  const [metadata, setMetadata] = useState<PayeesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const [reportResult, metadataResult] = await Promise.all([
        apiFetch<PayeesReportResponse>(`/api/finances/payees/report?range=${r}`, {
          silentToast: true,
        }),
        apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true }),
      ]);
      setData(reportResult);
      setMetadata(metadataResult);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const currency = data?.currency ?? 'EUR';
  const metadataById = new Map(metadata?.payees.map(payee => [payee.id, payee]) ?? []);
  const sorted = [...(data?.payees ?? [])].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return b[sortBy] - a[sortBy];
  });
  const [editingPayee, setEditingPayee] = useState<PayeeSuggestion | null>(null);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Payees</div>

      {/* Range filter */}
      <div className="flex gap-1.5">
        {RANGES.map(({ key, label }) => {
          const active = range === key;
          return (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={cn(
                'cursor-pointer rounded-[20px] px-3 py-[5px] text-[11px]',
                active
                  ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)] font-semibold'
                  : 'bg-[var(--fin-card2)] text-[var(--fin-muted)]',
              )}
              style={{ border: active ? `1px solid var(--fin-accent)44` : `1px solid var(--fin-border)` }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          className="h-[300px] rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
          style={{ opacity: 0.6 }}
        />
      ) : (
        <Card className="p-0">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_90px] border-b border-[var(--fin-border)] px-[14px] py-[10px]">
            {(
              [
                ['name', 'Payee'],
                ['txCount', 'Txns'],
                ['totalSpent', 'Total'],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <div
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  'cursor-pointer text-[10px] uppercase tracking-[0.08em]',
                  key === 'name' ? 'text-left' : 'text-right',
                  sortBy === key ? 'font-bold text-[var(--fin-accent)]' : 'font-normal text-[var(--fin-subtle)]',
                )}
              >
                {label} {sortBy === key && '↓'}
              </div>
            ))}
          </div>

          {sorted.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--fin-subtle)]">No payee data for this period</div>
          )}

          {sorted.map((p, i) => {
            const catColor = p.categoryColor ?? 'var(--fin-muted)';
            const meta = metadataById.get(p.id);
            const extraBits = [
              p.categoryName ? `${p.categoryName} · Last: ${p.lastDate}` : `Last: ${p.lastDate}`,
              meta?.aliases.length ? `Aliases: ${meta.aliases.join(', ')}` : null,
              meta?.notes ? meta.notes : null,
            ].filter(Boolean);
            return (
              <div key={p.id}>
                {i > 0 && <Divider />}
                <div className="grid grid-cols-[1fr_80px_90px] items-center px-[14px] py-[10px]">
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon color={catColor} icon={p.categoryIcon} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[13px] font-medium text-[var(--fin-text)]">{p.name}</div>
                        {meta && (
                          <button
                            aria-label={`Edit payee ${p.name}`}
                            onClick={() => setEditingPayee(meta)}
                            className="cursor-pointer rounded p-1 text-[var(--fin-subtle)] hover:bg-[var(--fin-card2)] hover:text-[var(--fin-text)]"
                          >
                            <PencilIcon className="size-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--fin-subtle)]">
                        {extraBits.map((bit, index) => (
                          <div key={`${p.id}-${index}`}>{bit}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums text-[var(--fin-muted)]">{p.txCount}</div>
                  <div className="text-right text-[13px] font-semibold tabular-nums text-[var(--fin-text)]">
                    {fmt(p.totalSpent, currency)}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {editingPayee && (
        <EditPayeeModal
          payee={editingPayee}
          onClose={() => setEditingPayee(null)}
          onSaved={() => {
            setEditingPayee(null);
            load(range);
          }}
        />
      )}
    </div>
  );
}
