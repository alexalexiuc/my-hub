'use client';

import { Pill } from '@/components';
import { cn } from '@/lib/utils';
import { fmt, Divider, CategoryIcon } from '../ui';
import { categoryIconEmoji } from '../categoryIcons';

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
  accountName?: string;
  toAccountName?: string | null;
  balanceAfter?: number | null;
  isCorrection?: boolean;
}

type TransactionListProps = {
  transactions: TransactionItem[];
  currency: string;
  emptyMessage?: string;
  showAccount?: boolean;
};

export function TransactionList({
  transactions,
  currency,
  emptyMessage = 'No transactions yet',
  showAccount = false,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return <div className="py-6 text-center text-[13px] text-[var(--fin-subtle)]">{emptyMessage}</div>;
  }

  return (
    <>
      {transactions.map((tx, i) => {
        const isTransfer = tx.type === 'transfer';
        const catColor = tx.categoryColor ?? (tx.isCorrection ? 'var(--fin-amber)' : 'var(--fin-muted)');
        const label = tx.isCorrection ? (tx.notes ?? 'Balance Correction') : (tx.payeeName ?? tx.notes ?? '—');
        const accountLabel =
          isTransfer && tx.toAccountName ? `${tx.accountName} → ${tx.toAccountName}` : tx.accountName;
        const amountColorClass =
          tx.type === 'income'
            ? 'text-[var(--fin-green)]'
            : isTransfer
              ? 'text-[var(--fin-blue)]'
              : 'text-[var(--fin-red)]';

        return (
          <div key={tx.id}>
            {i > 0 && <Divider />}
            <div className="flex items-center gap-2 py-[3px]">
              <CategoryIcon color={catColor} size="sm">
                {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
              </CategoryIcon>
              {showAccount && accountLabel && (
                <span className="shrink-0 text-[11px] text-[var(--fin-subtle)]">{accountLabel}</span>
              )}
              {!isTransfer && (
                <span
                  className={cn(
                    'shrink-0 text-[13px] font-medium',
                    tx.isCorrection ? 'text-[var(--fin-amber)]' : 'text-[var(--fin-text)]',
                  )}
                >
                  {label}
                </span>
              )}
              {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
              <span className="flex-1" />
              <span className="w-[72px] shrink-0 text-right text-[11px] text-[var(--fin-subtle)]">{tx.date}</span>
              <div className="w-20 shrink-0 text-right">
                <div className={cn('text-[13px] font-semibold', amountColorClass)}>{fmt(tx.amount, currency)}</div>
                {tx.balanceAfter != null && (
                  <div className="text-[10px] text-[var(--fin-subtle)]">{fmt(tx.balanceAfter, currency)}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
