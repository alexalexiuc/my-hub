'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { AddButton } from '../ui';
import { Button } from '@/components';
import { TransactionModal } from './TransactionModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { TransactionList } from './TransactionList';
import type {
  TransactionListItem,
  TransactionMutationResponse,
  TransactionsListResponse,
} from '@/app/api/finances/transactions/route';
import { TransactionType, TransactionTypes } from '@my-hub/shared/constants';
import { MonthCarousel } from '../ui';
import { dateToString } from '@my-hub/shared/utils';

type Filter = 'all' | TransactionType;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: TransactionTypes.Expense, label: 'Expenses' },
  { key: TransactionTypes.Income, label: 'Income' },
  { key: TransactionTypes.Transfer, label: 'Transfers' },
];

function matchesFilter(filter: Filter, transaction: TransactionListItem) {
  return filter === 'all' || transaction.type === filter;
}

function sortTransactions(transactions: TransactionListItem[]) {
  return [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return right.id - left.id;
  });
}

function upsertTransaction(transactions: TransactionListItem[], transaction: TransactionListItem) {
  return sortTransactions([transaction, ...transactions.filter(item => item.id !== transaction.id)]);
}

function currentMonthStr(): string {
  return dateToString().slice(0, 7);
}

export default function TransactionsPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastImport, setLastImport] = useState<{ batchId: string; count: number } | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [month, setMonth] = useState(currentMonthStr);
  const [data, setData] = useState<TransactionsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 50;

  const load = useCallback(
    async (f: Filter, m: string, reset = true) => {
      const off = reset ? 0 : offset;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const q = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
        if (f !== 'all') q.set('type', f);
        q.set('month', m);
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
    load(filter, month, true);
  }, [filter, month]);

  // Read undo data from URL params (set by the import page on success)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get('imported');
    const count = params.get('count');
    if (batchId && count) {
      setLastImport({ batchId, count: parseInt(count, 10) });
      router.replace('/finances/transactions', { scroll: false });
    }
  }, []);

  const currency = data?.currency ?? 'EUR';

  async function handleUndo() {
    if (!lastImport) return;
    await apiFetch(`/api/finances/transactions/import/${lastImport.batchId}`, { method: 'DELETE' });
    setLastImport(null);
    load(filter, month, true);
  }

  function handleCreated(result?: TransactionMutationResponse) {
    setShowAddModal(false);

    if (!result?.listItem) {
      load(filter, month, true);
      return;
    }

    if (!matchesFilter(filter, result.listItem)) {
      return;
    }

    setData(prev => {
      if (!prev) return prev;
      const transactions = upsertTransaction(prev.transactions, result.listItem!);
      return { ...prev, transactions };
    });
    setOffset(prev => prev + 1);
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Desktop header */}
      <div className="hidden items-center justify-between md:flex">
        <MonthCarousel month={month} onNavigate={setMonth} currentMonth={currentMonthStr()} />
        <div className="flex items-center gap-2">
          <Link href="/finances/transactions/import">
            <Button variant="ghost">Import CSV</Button>
          </Link>
          <AddButton onClick={() => setShowAddModal(true)} title="Add transaction" />
        </div>
      </div>

      {/* Mobile header */}
      <div className="md:hidden">
        <div className="mb-2 flex items-center justify-between rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2.5">
          <MonthCarousel
            month={month}
            onNavigate={setMonth}
            currentMonth={currentMonthStr()}
            className="flex-1 justify-between"
            labelClassName="text-[32px] font-bold leading-none tracking-tight"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Transactions</div>
          <AddButton onClick={() => setShowAddModal(true)} title="Add transaction" />
        </div>
      </div>

      {/* Undo import banner */}
      {lastImport && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-text)]">
          <span>
            Imported {lastImport.count} transaction{lastImport.count !== 1 ? 's' : ''}
          </span>
          <button onClick={handleUndo} className="text-[var(--fin-red)] font-medium cursor-pointer">
            Undo import
          </button>
        </div>
      )}

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
          <div className="-mx-7 border-y border-[var(--fin-border)] bg-[var(--fin-card)] md:mx-0 md:rounded-[10px] md:border md:p-[14px]">
            <TransactionList
              transactions={data?.transactions ?? []}
              currency={currency}
              showAccount
              onEdit={id => setEditId(id)}
              onDelete={id => setPendingDeleteId(id)}
            />
          </div>

          {hasMore && (
            <button
              onClick={() => load(filter, month, false)}
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

      {showAddModal && <TransactionModal onCloseAction={() => setShowAddModal(false)} onSavedAction={handleCreated} />}

      {editId !== null && (
        <TransactionModal
          editId={editId}
          onCloseAction={() => setEditId(null)}
          onSavedAction={() => {
            setEditId(null);
            load(filter, month, true);
          }}
        />
      )}

      {pendingDeleteId !== null && (
        <ConfirmDeleteModal
          transactionId={pendingDeleteId}
          onClose={() => setPendingDeleteId(null)}
          onDeleted={() => {
            setPendingDeleteId(null);
            load(filter, month, true);
          }}
        />
      )}
    </div>
  );
}
