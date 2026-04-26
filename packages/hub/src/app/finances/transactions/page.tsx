'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card } from '../ui';
import { AddTransactionModal } from './AddTransactionModal';
import { TransactionList } from './TransactionList';

interface TxItem {
  id: number;
  date: string;
  amount: number;
  type: string;
  notes: string | null;
  payeeName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountName: string;
  toAccountName: string | null;
}

interface ListData {
  transactions: TxItem[];
  currency: string;
}

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
  const [data, setData] = useState<ListData | null>(null);
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
        const result = await apiFetch<ListData>(`/api/finances/transactions?${q}`, { silentToast: true });
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
        <div className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fin-text)' }}>
          Transactions
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="cursor-pointer rounded-[20px] border px-3 py-1.5 text-[11px] font-semibold"
          style={{
            background: 'var(--fin-accent-d)',
            border: `1px solid ${'var(--fin-accent)'}44`,
            color: 'var(--fin-accent)',
          }}
        >
          + Add
        </button>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="cursor-pointer rounded-[20px] px-3 py-[5px] text-[11px]"
              style={{
                background: active ? 'var(--fin-accent-d)' : 'var(--fin-card2)',
                border: active ? `1px solid ${'var(--fin-accent)'}44` : `1px solid ${'var(--fin-border)'}`,
                color: active ? 'var(--fin-accent)' : 'var(--fin-muted)',
                fontWeight: active ? 600 : 400,
              }}
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
                borderBottom: `1px solid ${'var(--fin-border)'}22`,
                background: i % 2 === 0 ? 'var(--fin-card)' : 'transparent',
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <Card style={{ padding: 14 }}>
            <TransactionList transactions={data?.transactions ?? []} currency={currency} showAccount />
          </Card>

          {hasMore && (
            <button
              onClick={() => load(filter, false)}
              disabled={loadingMore}
              className="w-full rounded-lg p-2.5 text-xs"
              style={{
                background: 'var(--fin-card2)',
                border: `1px solid ${'var(--fin-border)'}`,
                color: 'var(--fin-muted)',
                cursor: loadingMore ? 'default' : 'pointer',
              }}
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
