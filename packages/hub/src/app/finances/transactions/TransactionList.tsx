'use client';

import { fmt, Divider, Pill, CategoryIcon } from '../ui';
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
    return (
      <div className="py-6 text-center text-[13px]" style={{ color: 'var(--fin-subtle)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {transactions.map((tx, i) => {
        const isTransfer = tx.type === 'transfer';
        const catColor = tx.categoryColor ?? (tx.isCorrection ? 'var(--fin-amber)' : 'var(--fin-muted)');
        const label = tx.isCorrection ? (tx.notes ?? 'Balance Correction') : (tx.payeeName ?? tx.notes ?? '—');
        const accountLabel =
          isTransfer && tx.toAccountName ? `${tx.accountName} → ${tx.toAccountName}` : tx.accountName;
        const amountColor =
          tx.type === 'income' ? 'var(--fin-green)' : isTransfer ? 'var(--fin-blue)' : 'var(--fin-red)';

        return (
          <div key={tx.id}>
            {i > 0 && <Divider />}
            <div className="flex items-center gap-2 py-[3px]">
              <CategoryIcon color={catColor} size="sm">
                {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
              </CategoryIcon>
              {showAccount && accountLabel && (
                <span className="shrink-0 text-[11px]" style={{ color: 'var(--fin-subtle)' }}>
                  {accountLabel}
                </span>
              )}
              {!isTransfer && (
                <span
                  className="shrink-0 text-[13px] font-medium"
                  style={{
                    color: tx.isCorrection ? 'var(--fin-amber)' : 'var(--fin-text)',
                  }}
                >
                  {label}
                </span>
              )}
              {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
              <span className="flex-1" />
              <span className="w-[72px] shrink-0 text-right text-[11px]" style={{ color: 'var(--fin-subtle)' }}>
                {tx.date}
              </span>
              <div className="w-20 shrink-0 text-right">
                <div className="text-[13px] font-semibold" style={{ color: amountColor }}>
                  {fmt(tx.amount, currency)}
                </div>
                {tx.balanceAfter != null && (
                  <div className="text-[10px]" style={{ color: 'var(--fin-subtle)' }}>
                    {fmt(tx.balanceAfter, currency)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
