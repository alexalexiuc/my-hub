'use client';

import { SubText } from '@/components';
import { fmt } from './ui';
import { formatFxRateLabel } from './finances.utils';

type ForeignBalanceLineProps = {
  balance: number;
  currency: string;
  /** null when no rate is known at all. */
  balanceInDefaultCurrency: number | null;
  defaultCurrency: string;
  rate: number | null;
  rateDate: string | null;
  className?: string;
};

/** "≈ 5.027,50 MDL · 20.1101 · 03 Oct" — the budget-currency value of a foreign-currency balance at the current rate. */
export function ForeignBalanceLine({
  balanceInDefaultCurrency,
  defaultCurrency,
  rate,
  rateDate,
  className,
}: ForeignBalanceLineProps) {
  if (balanceInDefaultCurrency == null || rate == null || rateDate == null) {
    return <SubText className={className}>≈ — {defaultCurrency} · no rate yet</SubText>;
  }
  return (
    <SubText className={className}>
      ≈ {fmt(balanceInDefaultCurrency, defaultCurrency)} · {formatFxRateLabel(rate, rateDate)}
    </SubText>
  );
}
