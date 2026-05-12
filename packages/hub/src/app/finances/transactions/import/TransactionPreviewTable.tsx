'use client';

import { cn } from '@/lib/utils';
import { FinancialDropdown } from '../../FinancialDropdown';
import type { DropdownOption } from '../../FinancialDropdown';
import { TransactionTypes } from '@my-hub/shared/constants';
import { fmt } from '../../ui';
import { TypeToggle } from './TypeToggle';
import { CurrencyCell } from './CurrencyCell';
import type { ImportRow, ColumnMap } from './types';

export type TransactionPreviewTableProps = {
  importRows: ImportRow[];
  colMap: ColumnMap;
  currency: string;
  accountOptions: DropdownOption[];
  categoryOptions: DropdownOption[];
  accounts: Array<{ id: number; currency: string }>;
  onUpdateRow: (key: string, patch: Partial<ImportRow>) => void;
};

export function TransactionPreviewTable({
  importRows,
  colMap,
  currency,
  accountOptions,
  categoryOptions,
  accounts,
  onUpdateRow,
}: TransactionPreviewTableProps) {
  return (
    <div className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-[var(--fin-border)]">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--fin-border)] bg-[var(--fin-card2)] text-[var(--fin-subtle)]">
              <th className="py-2 pl-3 pr-2 text-left font-medium">Ign.</th>
              <th className="py-2 pr-2 text-left font-medium">Date</th>
              <th className="py-2 pr-2 text-right font-medium">Amount</th>
              {colMap.currencyCol && <th className="py-2 pr-2 text-left font-medium">Curr.</th>}
              <th className="py-2 pr-2 text-left font-medium">Type</th>
              <th className="py-2 pr-2 text-left font-medium">Account</th>
              <th className="py-2 pr-2 text-left font-medium">Category</th>
              <th className="py-2 pr-3 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {importRows.map(row => (
              <tr
                key={row._key}
                className={cn(
                  'border-b border-[var(--fin-border)] last:border-0 transition-opacity',
                  row.ignored ? 'opacity-35' : '',
                )}
              >
                <td className="py-1.5 pl-3 pr-2">
                  <input
                    type="checkbox"
                    checked={row.ignored}
                    onChange={e => onUpdateRow(row._key, { ignored: e.target.checked })}
                    className="cursor-pointer"
                    title="Ignore this row"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  {row.date ? (
                    <span className="font-mono text-[11px]">
                      {row.date}
                      {row.isDuplicate && (
                        <span className="ml-1 text-[9px] text-[var(--fin-amber)]" title="Possible duplicate">
                          ⚠
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      className="font-mono text-[11px] text-[var(--fin-red)] cursor-help"
                      title={`Unrecognised date format: "${row.rawDate}". Supported: YYYY-MM-DD, YYYYMMDD, DD.MM.YYYY, DD/MM/YYYY, MM/DD/YYYY`}
                    >
                      {row.rawDate || '—'} ✗
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono">
                  <span
                    style={{
                      color:
                        row.type === TransactionTypes.Expense
                          ? 'var(--fin-red)'
                          : row.type === TransactionTypes.Income
                            ? 'var(--fin-green)'
                            : 'var(--fin-blue)',
                    }}
                  >
                    {row.type === TransactionTypes.Expense ? '−' : '+'}
                    {fmt(row.amount, currency).replace(/[^0-9.,]/g, '')}
                  </span>
                </td>
                {colMap.currencyCol && (
                  <td className="py-1.5 pr-2">
                    <CurrencyCell csvCurrency={row.csvCurrency} accountId={row.accountId} accounts={accounts} />
                  </td>
                )}
                <td className="py-1.5 pr-2">
                  <TypeToggle value={row.type} onChange={t => onUpdateRow(row._key, { type: t })} />
                </td>
                <td className="min-w-[130px] py-1.5 pr-2">
                  <div className="flex flex-col gap-1">
                    <FinancialDropdown
                      options={accountOptions}
                      value={row.accountId}
                      onChange={opt => onUpdateRow(row._key, { accountId: opt ? Number(opt.id) : row.accountId })}
                      searchable
                      fuse
                      inputClassName="text-xs py-0.5"
                    />
                    {row.type === TransactionTypes.Transfer && (
                      <FinancialDropdown
                        options={accountOptions.filter(o => o.id !== row.accountId)}
                        value={row.toAccountId ?? undefined}
                        onChange={opt => onUpdateRow(row._key, { toAccountId: opt ? Number(opt.id) : null })}
                        placeholder="To account…"
                        searchable
                        fuse
                        inputClassName={cn('text-xs py-0.5', !row.toAccountId && 'border border-[var(--fin-red)]')}
                      />
                    )}
                  </div>
                </td>
                <td className="min-w-[130px] py-1.5 pr-2">
                  {row.type !== TransactionTypes.Transfer ? (
                    <div className="flex flex-col gap-0.5">
                      <FinancialDropdown
                        options={categoryOptions}
                        value={row.categoryId ?? undefined}
                        onChange={opt => onUpdateRow(row._key, { categoryId: opt ? Number(opt.id) : null })}
                        placeholder="Category…"
                        searchable
                        fuse
                        clearable
                        inputClassName={cn(
                          'text-xs py-0.5',
                          row.type === TransactionTypes.Expense && !row.categoryId && 'border border-[var(--fin-red)]',
                        )}
                      />
                    </div>
                  ) : (
                    <span className="text-[var(--fin-muted)]">—</span>
                  )}
                </td>
                <td className="min-w-[100px] py-1.5 pr-3">
                  <input
                    type="text"
                    value={row.notes}
                    onChange={e => onUpdateRow(row._key, { notes: e.target.value })}
                    className="w-full bg-transparent text-xs text-[var(--fin-text)] outline-none placeholder:text-[var(--fin-muted)]"
                    placeholder="—"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
