'use client';

import { formatMoney } from '@my-hub/shared/utils';
import { cn } from '@/lib/utils';
import { SubText } from '@/components';
import { formatFxRateLabel } from './finances.utils';
import type { BalanceConversion } from '@/app/api/finances/money.schema';

type ForeignBalanceLineProps = {
  value: BalanceConversion;
  defaultCurrency: string;
  className?: string;
};

/** "≈ 5.027,50 MDL · 20.1101 · 03 Oct" — the budget-currency value of a foreign-currency balance at the current rate. */
export function ForeignBalanceLine({ value, defaultCurrency, className }: ForeignBalanceLineProps) {
  const { balanceInDefaultCurrency, rate, rateDate } = value;
  return (
    <SubText className={cn('block text-[10px] tabular-nums', className)}>
      {balanceInDefaultCurrency == null || rate == null || rateDate == null
        ? `≈ — ${defaultCurrency} · no rate yet`
        : `≈ ${formatMoney(balanceInDefaultCurrency, defaultCurrency)} · ${formatFxRateLabel(rate, rateDate)}`}
    </SubText>
  );
}
