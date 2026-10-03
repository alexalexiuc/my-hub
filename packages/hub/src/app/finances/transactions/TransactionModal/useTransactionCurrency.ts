'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { FxRateSources } from '@my-hub/shared/constants';
import type { ExchangeRateResponse } from '@/app/api/finances/exchange-rate/route';
import type { TransactionDetail } from '@/app/api/finances/transactions/[id]/route';
import { formatTransferRate } from '../../finances.utils';

type UseTransactionCurrencyArgs = {
  /** Currency of the selected (source) account; null until an account is chosen. */
  accountCurrency: string | null;
  /** Transfers: currency of the destination account. */
  toAccountCurrency: string | null;
  isTransfer: boolean;
  date: string;
  /** Amount as typed, in the selected amount currency. */
  amount: number;
};

/**
 * Currency state of the transaction form: which currency the typed amount is in, the rate that
 * converts it into the account currency (prefilled from the market rate, editable), and the
 * received amount of a transfer between accounts in different currencies.
 */
export function useTransactionCurrency({
  accountCurrency,
  toAccountCurrency,
  isTransfer,
  date,
  amount,
}: UseTransactionCurrencyArgs) {
  // null = "same as the account" — follows the account when it changes.
  const [amountCurrency, setAmountCurrencyState] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [rateEdited, setRateEdited] = useState(false);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [rateUnavailable, setRateUnavailable] = useState(false);
  const [toAmountInput, setToAmountInput] = useState('');

  const effectiveCurrency = amountCurrency ?? accountCurrency;
  const needsRate = accountCurrency != null && effectiveCurrency != null && effectiveCurrency !== accountCurrency;
  const isCrossCurrencyTransfer =
    isTransfer && accountCurrency != null && toAccountCurrency != null && toAccountCurrency !== accountCurrency;
  // Typed in the destination currency → that is what arrives; otherwise the received side must be entered.
  const needsToAmount = isCrossCurrencyTransfer && effectiveCurrency !== toAccountCurrency;

  // Prefill the market rate for the pair/date unless the user typed their own.
  useEffect(() => {
    if (!needsRate || !effectiveCurrency || !accountCurrency || !date) return;
    let cancelled = false;
    apiFetch<ExchangeRateResponse>('/api/finances/exchange-rate', {
      query: { from: effectiveCurrency, to: accountCurrency, date },
      silentToast: true,
    })
      .then(res => {
        if (cancelled) return;
        setRateUnavailable(res.rate == null);
        if (rateEdited) return;
        setRateInput(res.rate != null ? String(res.rate) : '');
        setRateDate(res.rateDate);
      })
      .catch(() => {
        if (!cancelled) setRateUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsRate, effectiveCurrency, accountCurrency, date, rateEdited]);

  const rate = parseFloat(rateInput);
  const toAmount = parseFloat(toAmountInput);
  const amountInAccountCurrency = needsRate ? (rate > 0 ? amount * rate : null) : amount;

  const transferRateLabel = useMemo(() => {
    if (!isCrossCurrencyTransfer || amountInAccountCurrency == null || !accountCurrency || !toAccountCurrency) {
      return null;
    }
    const received = needsToAmount ? toAmount : amount;
    return formatTransferRate(amountInAccountCurrency, accountCurrency, received, toAccountCurrency);
  }, [
    isCrossCurrencyTransfer,
    needsToAmount,
    amountInAccountCurrency,
    accountCurrency,
    toAccountCurrency,
    toAmount,
    amount,
  ]);

  const isValid = (!needsRate || rate > 0) && (!needsToAmount || toAmount > 0);

  const setAmountCurrency = useCallback(
    (currency: string) => {
      setAmountCurrencyState(currency === accountCurrency ? null : currency);
      setRateEdited(false);
    },
    [accountCurrency],
  );

  const onRateChange = useCallback((value: string) => {
    setRateInput(value);
    setRateEdited(true);
    setRateDate(null);
  }, []);

  /** Request fields for POST/PATCH. The rate is sent only when typed, so an untouched market rate stays "market". */
  const requestFields = () => ({
    amountCurrency: needsRate ? effectiveCurrency : null,
    rate: needsRate && rateEdited && rate > 0 ? rate : undefined,
    toAmount: needsToAmount && toAmount > 0 ? toAmount : undefined,
  });

  /** Edit mode: restore what the user originally typed. Returns the amount to show in the amount field. */
  const hydrate = useCallback((detail: TransactionDetail): number => {
    if (detail.original) {
      setAmountCurrencyState(detail.original.currency);
      setRateInput(String(detail.original.rate));
      setRateEdited(detail.original.rateSource === FxRateSources.User);
    }
    if (detail.toAmount != null) setToAmountInput(String(detail.toAmount));
    return detail.original?.amount ?? detail.amount;
  }, []);

  return {
    effectiveCurrency,
    setAmountCurrency,
    needsRate,
    rateInput,
    onRateChange,
    rateEdited,
    rateDate,
    rateUnavailable,
    amountInAccountCurrency,
    isCrossCurrencyTransfer,
    needsToAmount,
    toAmountInput,
    setToAmountInput,
    transferRateLabel,
    isValid,
    requestFields,
    hydrate,
  };
}

export type TransactionCurrencyState = ReturnType<typeof useTransactionCurrency>;
