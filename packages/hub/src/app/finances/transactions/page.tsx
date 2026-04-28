'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { AddButton, Card } from '../ui';
import { AddTransactionModal } from './AddTransactionModal';
import { TransactionList } from './TransactionList';
import type { TransactionsListResponse } from '@/app/api/finances/contracts';

type Filter = 'all' | 'expense' | 'income' | 'transfer';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfers' },
];

export default function TransactionsPage() {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [data, setData] = useState<TransactionsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 50;

  const load = useCallback(
    async (f: Filter, reset = true) => {
      const off = reset ? 0 : offset;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const q = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
        if (f !== 'all') q.set('type', f);
        const result = await apiFetch<TransactionsListResponse>(`/api/finances/transactions?${q}`, {
          silentToast: true,
        });
        if (reset) {
          setData(result);
          setOffset(result.transactions.length);
        } else {
          setData(prev => (prev ? { ...prev, transactions: [...prev.transactions, ...result.transactions] } : result));
          setOffset(off + result.transactions.length);
        }
        setHasMore(result.transactions.length === LIMIT);
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [offset],
  );

  useEffect(() => {
    load(filter, true);
  }, [filter]);

  const currency = data?.currency ?? 'EUR';

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Transactions</div>
        <AddButton onClick={() => setShowModal(true)} title="Add transaction" />
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
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
        <div className="flex flex-col gap-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[58px]"
              style={{
                borderBottom: `1px solid var(--fin-border)22`,
                background: i % 2 === 0 ? 'var(--fin-card)' : 'transparent',
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <Card className="p-[14px]">
            <TransactionList transactions={data?.transactions ?? []} currency={currency} showAccount />
          </Card>

          {hasMore && (
            <button
              onClick={() => load(filter, false)}
              disabled={loadingMore}
              className={cn(
                'w-full rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] p-2.5 text-xs text-[var(--fin-muted)]',
                loadingMore ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load(filter, true);
          }}
        />
      )}
    </div>
  );
}
