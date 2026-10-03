'use client';

import { Input, SubText } from '@/components';
import { fmt } from '../../ui';
import type { TransactionCurrencyState } from './useTransactionCurrency';

type CurrencyFieldsProps = {
  currency: TransactionCurrencyState;
  /** Renders each field inside the layout's own row/card wrapper. */
  renderField: (label: string, field: React.ReactNode) => React.ReactNode;
};

/**
 * Extra fields that appear only when currencies differ: the rate converting the typed amount into
 * the account currency, and the amount a cross-currency transfer's destination receives.
 */
export function CurrencyFields({ currency, renderField }: CurrencyFieldsProps) {
  const {
    accountCurrency,
    toAccountCurrency,
    effectiveCurrency,
    needsRate,
    rateInput,
    onRateChange,
    rateEdited,
    rateDate,
    rateUnavailable,
    amountInAccountCurrency,
    needsToAmount,
    toAmountInput,
    setToAmountInput,
    transferRateLabel,
  } = currency;

  return (
    <>
      {needsRate &&
        renderField(
          `Rate · 1 ${effectiveCurrency} in ${accountCurrency}`,
          <div>
            <Input
              value={rateInput}
              onChange={e => onRateChange(e.target.value)}
              type="text"
              inputMode="decimal"
              placeholder={rateUnavailable ? 'Enter the rate' : '0.0000'}
              variant="ghost"
              aria-label="Exchange rate"
              className="w-full text-[13px] text-[var(--text)]"
            />
            <SubText className="block tabular-nums">
              {amountInAccountCurrency != null && accountCurrency
                ? `= ${fmt(amountInAccountCurrency, accountCurrency)}`
                : '—'}
              {!rateEdited && rateDate ? ` · market rate ${rateDate}` : ''}
              {rateUnavailable && !rateEdited ? ' · no market rate, enter it' : ''}
            </SubText>
          </div>,
        )}

      {needsToAmount &&
        renderField(
          `Received (${toAccountCurrency})`,
          <div>
            <Input
              value={toAmountInput}
              onChange={e => setToAmountInput(e.target.value)}
              type="text"
              inputMode="decimal"
              placeholder="Amount received"
              variant="ghost"
              aria-label="Received amount"
              className="w-full text-[13px] text-[var(--text)]"
            />
            {transferRateLabel && <SubText className="block tabular-nums">Rate {transferRateLabel}</SubText>}
          </div>,
        )}
    </>
  );
}
