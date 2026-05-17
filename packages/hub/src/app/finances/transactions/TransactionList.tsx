'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, IconButton, Pill, SwipeRow } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { cn, apiFetch } from '@/lib/utils';
import { fmt, Divider, CategoryIcon, SectionLabel } from '../ui';
import { categoryIconEmoji } from '../categoryIcons';
import { TransactionTypes } from '@my-hub/shared/constants';
import { formatTransactionDate } from '../finances.utils';
import { transactionEvents } from './transactionEvents';
import { TransactionModal } from './TransactionModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import type { TransactionListItem, TransactionsListResponse } from '@/app/api/finances/transactions/route';
import type { TransactionType } from '@my-hub/shared/constants';

export type { TransactionListItem as TransactionItem };

type TransactionListProps = {
  month?: string;
  type?: TransactionType;
  categoryId?: number;
  accountId?: number;
  payeeId?: number;
  label?: string;
  limit?: number;
  emptyMessage?: string;
};

function UserAvatar({ initials }: { initials: string | null | undefined }) {
  if (!initials) return null;
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--fin-card2)] text-[9px] font-semibold uppercase text-[var(--fin-muted)]">
      {initials}
    </span>
  );
}

export function TransactionList({
  month,
  type,
  categoryId,
  accountId,
  payeeId,
  label,
  limit = 50,
  emptyMessage = 'No transactions yet',
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [openRowId, setOpenRowId] = useState<number | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean, currentOffset: number) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await apiFetch<TransactionsListResponse>('/api/finances/transactions', {
          query: { type, categoryId, accountId, payeeId, label, month, limit, offset: currentOffset },
          silentToast: true,
        });
        setCurrency(result.currency);
        if (reset) {
          setTransactions(result.transactions);
          setOffset(result.transactions.length);
        } else {
          setTransactions(prev => [...prev, ...result.transactions]);
          setOffset(currentOffset + result.transactions.length);
        }
        setHasMore(result.transactions.length === limit);
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [type, categoryId, accountId, payeeId, label, month, limit],
  );

  useEffect(() => {
    fetchPage(true, 0);
  }, [fetchPage]);

  useEffect(() => {
    const handler = () => fetchPage(true, 0);
    transactionEvents.on('changed', handler);
    return () => transactionEvents.off('changed', handler);
  }, [fetchPage]);

  if (loading) {
    return (
      <div className="flex flex-col gap-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[52px]"
            style={{
              borderBottom: `1px solid var(--fin-border)22`,
              background: i % 2 === 0 ? 'var(--fin-card)' : 'transparent',
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return <div className="py-6 text-center text-[13px] text-[var(--fin-subtle)]">{emptyMessage}</div>;
  }

  return (
    <>
      {/* Desktop column headers */}
      <div className="hidden md:flex items-center gap-3 pb-1.5 border-b border-[var(--fin-border)]">
        <span className="size-6 shrink-0" />
        <SectionLabel className="!mb-0 w-[110px] shrink-0">Category</SectionLabel>
        <SectionLabel className="!mb-0 w-[88px] shrink-0 text-right">Date</SectionLabel>
        <SectionLabel className="!mb-0 w-[140px] shrink-0">Payee</SectionLabel>
        <SectionLabel className="!mb-0 flex-1">Memo</SectionLabel>
        <SectionLabel className="!mb-0 w-[100px] shrink-0">Account</SectionLabel>
        <SectionLabel className="!mb-0 w-[120px] shrink-0 text-right">Amount</SectionLabel>
        <span className="w-7 shrink-0" />
      </div>

      {transactions.map((tx, i) => {
        const isTransfer = tx.type === TransactionTypes.Transfer;
        const catColor = tx.categoryColor ?? (tx.isCorrection ? 'var(--fin-amber)' : 'var(--fin-muted)');

        const desktopPayee = tx.isCorrection
          ? (tx.notes ?? 'Balance Correction')
          : isTransfer && tx.accountName && tx.toAccountName
            ? `${tx.accountName} ↔ ${tx.toAccountName}`
            : (tx.payeeName ?? '—');

        const desktopAccount = tx.accountName ?? '—';
        const desktopMemo = !tx.isCorrection ? (tx.notes ?? null) : null;

        const mobileLabel = tx.isCorrection
          ? (tx.notes ?? 'Balance Correction')
          : isTransfer && tx.accountName && tx.toAccountName
            ? `${tx.accountName} ↔ ${tx.toAccountName}`
            : (tx.payeeName ?? '—');

        const amountColorClass =
          tx.type === TransactionTypes.Income
            ? 'text-[var(--fin-green)]'
            : isTransfer
              ? 'text-[var(--fin-blue)]'
              : 'text-[var(--fin-red)]';

        return (
          <div key={tx.id}>
            {i > 0 && <Divider />}

            {/* ── Mobile row (< md) — SwipeRow ── */}
            <div data-layout="mobile" className="md:hidden">
              <SwipeRow
                isOpen={openRowId === tx.id}
                onOpen={() => setOpenRowId(tx.id)}
                onClose={() => setOpenRowId(null)}
                onEdit={() => setEditId(tx.id)}
                onDelete={() => setPendingDeleteId(tx.id)}
              >
                <div className="flex items-center gap-2.5 py-2.5 pl-[14px] pr-[14px] md:pl-0 md:pr-2">
                  <CategoryIcon color={catColor} size="sm">
                    {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
                  </CategoryIcon>

                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'truncate text-[13px] font-medium leading-snug',
                        tx.isCorrection ? 'text-[var(--fin-amber)]' : 'text-[var(--fin-text)]',
                      )}
                    >
                      {mobileLabel}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
                      {tx.labels?.slice(0, 2).map(lbl => (
                        <Pill key={lbl} label={lbl} color="var(--fin-accent)" />
                      ))}
                      {(tx.labels?.length ?? 0) > 2 && (
                        <span className="text-[10px] text-[var(--fin-subtle)]">+{(tx.labels?.length ?? 0) - 2}</span>
                      )}
                      {tx.notes && !tx.isCorrection && tx.payeeName && (
                        <span className="truncate text-[11px] text-[var(--fin-subtle)]">{tx.accountName}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={cn('text-[13px] font-semibold tabular-nums leading-snug', amountColorClass)}>
                      {fmt(tx.amount, currency)}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[10px] text-[var(--fin-subtle)]">{formatTransactionDate(tx.date)}</span>
                      <UserAvatar initials={tx.addedByInitials} />
                    </div>
                  </div>
                </div>
              </SwipeRow>
            </div>

            {/* ── Desktop row (md+) ── */}
            <div data-layout="desktop" className="group relative hidden md:flex items-center gap-3 py-1.5">
              <CategoryIcon color={catColor} size="sm">
                {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
              </CategoryIcon>

              <div className="w-[110px] shrink-0">
                {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
              </div>

              <span className="w-[88px] shrink-0 text-right text-[11px] text-[var(--fin-subtle)]">
                {formatTransactionDate(tx.date)}
              </span>

              <span
                className={cn(
                  'w-[140px] shrink-0 truncate text-[13px] font-medium',
                  tx.isCorrection ? 'text-[var(--fin-amber)]' : 'text-[var(--fin-text)]',
                )}
                title={desktopPayee}
              >
                {desktopPayee}
              </span>

              <div className="flex flex-1 min-w-0 items-center gap-1.5">
                {tx.labels?.slice(0, 2).map(lbl => (
                  <Pill key={lbl} label={lbl} color="var(--fin-accent)" />
                ))}
                {(tx.labels?.length ?? 0) > 2 && (
                  <span className="text-[10px] text-[var(--fin-subtle)]">+{(tx.labels?.length ?? 0) - 2}</span>
                )}
                <span className="min-w-0 truncate text-[12px] text-[var(--fin-subtle)]" title={desktopMemo ?? ''}>
                  {desktopMemo}
                </span>
              </div>

              <span className="w-[100px] shrink-0 truncate text-[11px] text-[var(--fin-subtle)]" title={desktopAccount}>
                {desktopAccount}
              </span>

              <div className="w-[120px] shrink-0 text-right">
                <div className={cn('text-[13px] font-semibold tabular-nums', amountColorClass)}>
                  {fmt(tx.amount, currency)}
                </div>
              </div>

              <div className="w-7 shrink-0 flex items-center justify-center">
                <UserAvatar initials={tx.addedByInitials} />
              </div>

              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
                <div className="flex items-center gap-1 rounded-md border border-[var(--fin-border)] bg-[var(--fin-card)] px-1.5 py-1 shadow-sm">
                  <IconButton
                    label="Edit"
                    icon={<PencilIcon className="size-3.5" />}
                    onClick={() => setEditId(tx.id)}
                    className="bg-transparent p-1 text-[var(--fin-muted)] hover:bg-[var(--fin-card2)] hover:text-[var(--fin-text)]"
                  />
                  <span className="h-3 w-px bg-[var(--fin-border)]" />
                  <IconButton
                    label="Delete"
                    icon={<TrashIcon className="size-3.5" />}
                    onClick={() => setPendingDeleteId(tx.id)}
                    className="bg-transparent p-1 text-[var(--fin-muted)] hover:bg-[var(--fin-red)]/10 hover:text-[var(--fin-red)]"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <div className="px-[14px] pb-[14px] md:px-0 md:pb-0">
          <Button
            variant="ghost"
            onClick={() => fetchPage(false, offset)}
            disabled={loadingMore}
            className={cn('mt-2.5 w-full p-2 text-xs text-[var(--fin-muted)]', loadingMore && 'opacity-60')}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      {editId !== null && (
        <TransactionModal
          editId={editId}
          onCloseAction={() => setEditId(null)}
          onSavedAction={() => {
            setEditId(null);
            transactionEvents.emit('changed');
          }}
        />
      )}

      {pendingDeleteId !== null && (
        <ConfirmDeleteModal
          transactionId={pendingDeleteId}
          onClose={() => setPendingDeleteId(null)}
          onDeleted={() => {
            setPendingDeleteId(null);
            transactionEvents.emit('changed');
          }}
        />
      )}
    </>
  );
}
