'use client';

import { T, fmt, Divider, Pill } from '../ui';
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
    return <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: T.subtle }}>{emptyMessage}</div>;
  }

  return (
    <>
      {transactions.map((tx, i) => {
        const isTransfer = tx.type === 'transfer';
        const catColor = tx.categoryColor ?? (tx.isCorrection ? T.amber : T.muted);
        const label = tx.isCorrection ? (tx.notes ?? 'Balance Correction') : (tx.payeeName ?? tx.notes ?? '—');
        const accountLabel =
          isTransfer && tx.toAccountName ? `${tx.accountName} → ${tx.toAccountName}` : tx.accountName;
        const amountColor = tx.type === 'income' ? T.green : isTransfer ? T.blue : T.red;

        return (
          <div key={tx.id}>
            {i > 0 && <Divider />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
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
                {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
              </div>
              {showAccount && accountLabel && (
                <span style={{ fontSize: 11, color: T.subtle, flexShrink: 0 }}>{accountLabel}</span>
              )}
              {!isTransfer && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: tx.isCorrection ? T.amber : T.text,
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
              )}
              {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: T.subtle, flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
                {tx.date}
              </span>
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: amountColor }}>{fmt(tx.amount, currency)}</div>
                {tx.balanceAfter != null && (
                  <div style={{ fontSize: 10, color: T.subtle }}>{fmt(tx.balanceAfter, currency)}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
