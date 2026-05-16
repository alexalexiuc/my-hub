'use client';

import { useState } from 'react';
import { Pill, SwipeRow } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { fmt, Divider, CategoryIcon } from '../ui';
import { categoryIconEmoji } from '../categoryIcons';
import { TransactionTypes } from '@my-hub/shared/constants';

export interface TransactionItem {
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
  toAccountName?: string | null;
  balanceAfter?: number | null;
  isCorrection?: boolean;
  addedByInitials: string | null;
}

type TransactionListProps = {
  transactions: TransactionItem[];
  currency: string;
  emptyMessage?: string;
  showAccount?: boolean;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
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
  transactions,
  currency,
  emptyMessage = 'No transactions yet',
  showAccount: _showAccount = false,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const [openRowId, setOpenRowId] = useState<number | null>(null);

  if (transactions.length === 0) {
    return <div className="py-6 text-center text-[13px] text-[var(--fin-subtle)]">{emptyMessage}</div>;
  }

  const hasActions = onEdit || onDelete;

  return (
    <>
      {/* Desktop column headers */}
      <div className="hidden md:flex items-center gap-3 pb-1.5 border-b border-[var(--fin-border)]">
        <span className="size-6 shrink-0" />
        <span className="w-[110px] shrink-0 text-[10px] font-medium uppercase tracking-wide text-[var(--fin-subtle)]">
          Category
        </span>
        <span className="w-[88px] shrink-0 text-right text-[10px] font-medium uppercase tracking-wide text-[var(--fin-subtle)]">
          Date
        </span>
        <span className="w-[140px] shrink-0 text-[10px] font-medium uppercase tracking-wide text-[var(--fin-subtle)]">
          Payee
        </span>
        <span className="flex-1 text-[10px] font-medium uppercase tracking-wide text-[var(--fin-subtle)]">Memo</span>
        <span className="w-[100px] shrink-0 text-[10px] font-medium uppercase tracking-wide text-[var(--fin-subtle)]">
          Account
        </span>
        <span className="w-[120px] shrink-0 text-right text-[10px] font-medium uppercase tracking-wide text-[var(--fin-subtle)]">
          Amount
        </span>
        <span className="w-7 shrink-0" />
      </div>

      {transactions.map((tx, i) => {
        const isTransfer = tx.type === TransactionTypes.Transfer;
        const catColor = tx.categoryColor ?? (tx.isCorrection ? 'var(--fin-amber)' : 'var(--fin-muted)');

        // Payee col: for transfers show "From ↔ To", for corrections show label, else payeeName
        const desktopPayee = tx.isCorrection
          ? (tx.notes ?? 'Balance Correction')
          : isTransfer && tx.accountName && tx.toAccountName
            ? `${tx.accountName} ↔ ${tx.toAccountName}`
            : (tx.payeeName ?? '—');

        // Account col: source account (for transfers just the from-account)
        const desktopAccount = tx.accountName ?? '—';

        // Memo: notes (except when notes IS the label for corrections)
        const desktopMemo = !tx.isCorrection ? (tx.notes ?? null) : null;

        // Mobile label
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
                onEdit={onEdit ? () => onEdit(tx.id) : undefined}
                onDelete={onDelete ? () => onDelete(tx.id) : undefined}
              >
                <div className="flex items-center gap-2.5 py-2.5 pl-[14px] pr-[14px] md:pl-0 md:pr-2">
                  {/* Left: icon */}
                  <CategoryIcon color={catColor} size="sm">
                    {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
                  </CategoryIcon>

                  {/* Centre: 2-line label block */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: payee / main label */}
                    <div
                      className={cn(
                        'truncate text-[13px] font-medium leading-snug',
                        tx.isCorrection ? 'text-[var(--fin-amber)]' : 'text-[var(--fin-text)]',
                      )}
                    >
                      {mobileLabel}
                    </div>
                    {/* Line 2: category + memo */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
                      {tx.notes && !tx.isCorrection && tx.payeeName && (
                        <span className="truncate text-[11px] text-[var(--fin-subtle)]">{tx.accountName}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: amount + date + avatar stacked */}
                  <div className="shrink-0 text-right">
                    <div className={cn('text-[13px] font-semibold tabular-nums leading-snug', amountColorClass)}>
                      {fmt(tx.amount, currency)}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[10px] text-[var(--fin-subtle)]">{tx.date}</span>
                      <UserAvatar initials={tx.addedByInitials} />
                    </div>
                  </div>
                </div>
              </SwipeRow>
            </div>

            {/* ── Desktop row (md+) ── */}
            <div data-layout="desktop" className="group relative hidden md:flex items-center gap-3 py-1.5">
              {/* Icon */}
              <CategoryIcon color={catColor} size="sm">
                {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
              </CategoryIcon>

              {/* Category — 110px */}
              <div className="w-[110px] shrink-0">
                {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
              </div>

              {/* Date — 88px */}
              <span className="w-[88px] shrink-0 text-right text-[11px] text-[var(--fin-subtle)]">{tx.date}</span>

              {/* Payee — 140px */}
              <span
                className={cn(
                  'w-[140px] shrink-0 truncate text-[13px] font-medium',
                  tx.isCorrection ? 'text-[var(--fin-amber)]' : 'text-[var(--fin-text)]',
                )}
                title={desktopPayee}
              >
                {desktopPayee}
              </span>

              {/* Memo — flex-1 */}
              <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--fin-subtle)]" title={desktopMemo ?? ''}>
                {desktopMemo}
              </span>

              {/* Account — 100px */}
              <span className="w-[100px] shrink-0 truncate text-[11px] text-[var(--fin-subtle)]" title={desktopAccount}>
                {desktopAccount}
              </span>

              {/* Amount — 120px */}
              <div className="w-[120px] shrink-0 text-right">
                <div className={cn('text-[13px] font-semibold tabular-nums', amountColorClass)}>
                  {fmt(tx.amount, currency)}
                </div>
                {tx.balanceAfter != null && (
                  <div className="text-[10px] tabular-nums text-[var(--fin-subtle)]">
                    {fmt(tx.balanceAfter, currency)}
                  </div>
                )}
              </div>

              {/* Avatar — always visible */}
              <div className="w-7 shrink-0 flex items-center justify-center">
                <UserAvatar initials={tx.addedByInitials} />
              </div>

              {/* Hover action buttons — absolute overlay fading in from right */}
              {hasActions && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
                  <div className="flex items-center gap-1 rounded-md border border-[var(--fin-border)] bg-[var(--fin-card)] px-1.5 py-1 shadow-sm">
                    {onEdit && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onEdit(tx.id);
                        }}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--fin-muted)] hover:bg-[var(--fin-card2)] hover:text-[var(--fin-text)] transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="size-3" />
                        Edit
                      </button>
                    )}
                    {onEdit && onDelete && <span className="h-3 w-px bg-[var(--fin-border)]" />}
                    {onDelete && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onDelete(tx.id);
                        }}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--fin-muted)] hover:bg-[var(--fin-red)]/10 hover:text-[var(--fin-red)] transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="size-3" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
