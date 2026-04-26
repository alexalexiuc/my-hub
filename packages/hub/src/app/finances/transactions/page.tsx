'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, Pill, Divider } from '../ui';

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
  const router = useRouter();
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
          onClick={() => router.push('/finances/transactions/add')}
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
            {(!data || data.transactions.length === 0) && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: T.subtle }}>
                No transactions yet
              </div>
            )}
            {data?.transactions.map((tx, i) => {
              const catColor = tx.categoryColor ?? T.muted;
              const isTransfer = tx.type === 'transfer';
              const accountLabel =
                isTransfer && tx.toAccountName ? `${tx.accountName} → ${tx.toAccountName}` : tx.accountName;
              return (
                <div key={tx.id}>
                  {i > 0 && <Divider />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    {/* Category icon */}
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        flexShrink: 0,
                        background: catColor + '22',
                        border: `1px solid ${catColor}33`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                      }}
                    >
                      {isTransfer ? '↔' : (tx.categoryIcon ?? '•')}
                    </div>
                    {/* Account */}
                    <span style={{ fontSize: 11, color: T.subtle, flexShrink: 0 }}>{accountLabel}</span>
                    {/* Payee / to-account for transfers */}
                    {!isTransfer && (
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.text, flexShrink: 0 }}>
                        {tx.payeeName ?? tx.notes ?? '—'}
                      </span>
                    )}
                    {/* Category pill */}
                    {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
                    {/* Spacer */}
                    <span style={{ flex: 1 }} />
                    {/* Date */}
                    <span style={{ fontSize: 11, color: T.subtle, flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
                      {tx.date}
                    </span>
                    {/* Amount */}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: tx.type === 'income' ? T.green : isTransfer ? T.blue : T.red,
                        flexShrink: 0,
                        minWidth: 90,
                        textAlign: 'right',
                      }}
                    >
                      {fmt(tx.amount, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
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
    </div>
  );
}
