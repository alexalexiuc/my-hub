'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { T, Card } from '../ui';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Transactions</div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 11,
            background: T.accentD,
            border: `1px solid ${T.accent}44`,
            color: T.accent,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 11,
                cursor: 'pointer',
                background: active ? T.accentD : T.card2,
                border: active ? `1px solid ${T.accent}44` : `1px solid ${T.border}`,
                color: active ? T.accent : T.muted,
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 58,
                borderBottom: `1px solid ${T.border}22`,
                background: i % 2 === 0 ? T.card : 'transparent',
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
              style={{
                background: T.card2,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: '10px',
                fontSize: 12,
                color: T.muted,
                cursor: loadingMore ? 'default' : 'pointer',
                width: '100%',
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
