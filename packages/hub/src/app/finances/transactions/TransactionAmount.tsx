'use client';

import { SubText } from '@/components';
import { fmt } from '../ui';
import type { TransactionListItem } from '@/app/api/finances/transactions/route';

type TransactionAmountProps = {
  transaction: Pick<TransactionListItem, 'amount' | 'accountCurrency' | 'toAmount' | 'toAccountCurrency'>;
  className?: string;
};

/**
 * A ledger amount in its own account's currency. For a transfer between accounts in different
 * currencies it adds the received side underneath (e.g. "6.033,03 MDL" / "→ 300,00 €").
 */
export function TransactionAmount({ transaction, className }: TransactionAmountProps) {
  const { amount, accountCurrency, toAmount, toAccountCurrency } = transaction;
  const isCrossCurrency = toAmount != null && toAccountCurrency != null && toAccountCurrency !== accountCurrency;
  return (
    <>
      <div className={className}>{fmt(amount, accountCurrency)}</div>
      {isCrossCurrency && <SubText className="block tabular-nums">→ {fmt(toAmount, toAccountCurrency)}</SubText>}
    </>
  );
}
