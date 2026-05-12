'use client';

import { SupportedCurrencies } from '@my-hub/shared/constants';

export type CurrencyCellProps = {
  csvCurrency: string;
  accountId: number;
  accounts: Array<{ id: number; currency: string }>;
};

export function CurrencyCell({ csvCurrency, accountId, accounts }: CurrencyCellProps) {
  if (!csvCurrency) return <span className="text-[var(--fin-muted)]">—</span>;
  const isSupported = (SupportedCurrencies as readonly string[]).includes(csvCurrency);
  const accountCurrency = accounts.find(a => a.id === accountId)?.currency ?? '';
  const mismatch = isSupported && accountCurrency && csvCurrency !== accountCurrency;
  return (
    <span
      className="font-mono text-[11px]"
      style={{
        color: !isSupported ? 'var(--fin-red)' : mismatch ? 'var(--fin-amber)' : 'var(--fin-text)',
      }}
      title={
        !isSupported
          ? `Unsupported currency: ${csvCurrency}`
          : mismatch
            ? `Currency mismatch: CSV says ${csvCurrency}, account is ${accountCurrency}`
            : undefined
      }
    >
      {csvCurrency}
      {(!isSupported || mismatch) && ' ⚠'}
    </span>
  );
}
