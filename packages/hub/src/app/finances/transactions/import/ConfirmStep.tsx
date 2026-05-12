'use client';

import { Button } from '@/components';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import type { ImportRow } from './types';

export type ConfirmStepProps = {
  activeRows: ImportRow[];
  ignoredCount: number;
  filename: string;
  currency: string;
  rowsMissingDate: ImportRow[];
  transfersMissingTo: ImportRow[];
  nonTransferMissingCategory: ImportRow[];
  canImport: boolean;
  submitting: boolean;
  accounts: Array<{ id: number; currency: string }>;
  onImport: () => void;
  onBack: () => void;
};

export function ConfirmStep({
  activeRows,
  ignoredCount,
  filename,
  currency,
  rowsMissingDate,
  transfersMissingTo,
  nonTransferMissingCategory,
  canImport,
  submitting,
  accounts,
  onImport,
  onBack,
}: ConfirmStepProps) {
  const duplicateRows = activeRows.filter(r => r.isDuplicate);

  const unsupportedCurrencyRows = activeRows.filter(
    r => r.csvCurrency && !(SupportedCurrencies as readonly string[]).includes(r.csvCurrency),
  );
  const unsupportedCurrencyCodes = [...new Set(unsupportedCurrencyRows.map(r => r.csvCurrency))].join(', ');

  const mismatchedCurrencyRows = activeRows.filter(r => {
    if (!r.csvCurrency) return false;
    const acctCurrency = accounts.find(a => a.id === r.accountId)?.currency ?? '';
    return acctCurrency && r.csvCurrency !== acctCurrency;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-4">
        <div className="text-sm font-semibold text-[var(--fin-text)]">
          {activeRows.length} transaction{activeRows.length !== 1 ? 's' : ''} will be imported
        </div>
        {ignoredCount > 0 && (
          <div className="mt-0.5 text-xs text-[var(--fin-muted)]">
            {ignoredCount} row{ignoredCount !== 1 ? 's' : ''} ignored
          </div>
        )}
        <div className="mt-1 text-xs text-[var(--fin-muted)]">
          {filename} · {currency}
        </div>
      </div>

      {rowsMissingDate.length > 0 && (
        <div className="rounded-[8px] border border-[var(--fin-red)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-red)]">
          ✗ {rowsMissingDate.length} row{rowsMissingDate.length !== 1 ? 's are' : ' is'} missing a date — go back and
          check the Date column mapping.
        </div>
      )}
      {transfersMissingTo.length > 0 && (
        <div className="rounded-[8px] border border-[var(--fin-red)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-red)]">
          ✗ {transfersMissingTo.length} transfer row{transfersMissingTo.length !== 1 ? 's are' : ' is'} missing a
          destination account — go back and fix them.
        </div>
      )}
      {nonTransferMissingCategory.length > 0 && (
        <div className="rounded-[8px] border border-[var(--fin-red)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-red)]">
          ✗ {nonTransferMissingCategory.length} row
          {nonTransferMissingCategory.length !== 1 ? 's are' : ' is'} missing a category — go back and assign one.
        </div>
      )}
      {duplicateRows.length > 0 && (
        <div className="rounded-[8px] border border-[var(--fin-amber)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-amber)]">
          ⚠ {duplicateRows.length} row{duplicateRows.length !== 1 ? 's look' : ' looks'} like potential duplicates.
        </div>
      )}
      {unsupportedCurrencyRows.length > 0 && (
        <div className="rounded-[8px] border border-[var(--fin-red)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-red)]">
          ✗ {unsupportedCurrencyRows.length} row{unsupportedCurrencyRows.length !== 1 ? 's have' : ' has'} an
          unsupported currency ({unsupportedCurrencyCodes}). Supported: {SupportedCurrencies.join(', ')}.
        </div>
      )}
      {mismatchedCurrencyRows.length > 0 && (
        <div className="rounded-[8px] border border-[var(--fin-amber)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-amber)]">
          ⚠ {mismatchedCurrencyRows.length} row
          {mismatchedCurrencyRows.length !== 1 ? 's have' : ' has'} a currency that does not match the selected
          account's currency.
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button disabled={!canImport || submitting} onClick={onImport}>
          {submitting ? 'Importing…' : `Import ${activeRows.length} transactions`}
        </Button>
      </div>
    </div>
  );
}
