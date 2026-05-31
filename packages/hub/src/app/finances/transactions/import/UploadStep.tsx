'use client';

import { useRef } from 'react';
import { Button } from '@/components';
import { FinancialDropdown } from '../../FinancialDropdown';
import type { DropdownOption } from '../../FinancialDropdown';
import { ColumnSelect } from './ColumnSelect';
import { CSV_IMPORT_ROW_LIMIT } from './constants';
import type { ColumnMap } from './types';

export type UploadStepProps = {
  filename: string;
  rawRows: Record<string, string>[];
  headers: string[];
  colMap: ColumnMap;
  defaultAccountId: number | null;
  accountOptions: DropdownOption[];
  step1Valid: boolean;
  onFileChange: (file: File) => void;
  onColMapChange: (patch: Partial<ColumnMap>) => void;
  onAccountChange: (id: number | null) => void;
  onAdvance: () => void;
  onBack: () => void;
};

export function UploadStep({
  filename,
  rawRows,
  headers,
  colMap,
  defaultAccountId,
  accountOptions,
  step1Valid,
  onFileChange,
  onColMapChange,
  onAccountChange,
  onAdvance,
  onBack,
}: UploadStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      {/* File picker */}
      <div
        onClick={() => fileRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[var(--border)] p-8 text-center transition-colors hover:border-[var(--accent)]"
      >
        <div className="text-2xl">📂</div>
        <div className="text-sm font-medium text-[var(--text)]">
          {filename ? filename : 'Click to select a CSV file'}
        </div>
        {rawRows.length > 0 && <div className="text-xs text-[var(--muted)]">{rawRows.length} rows detected</div>}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onFileChange(file);
          }}
        />
      </div>

      {/* Account + column mapping — shown only after file is loaded */}
      {rawRows.length > 0 && (
        <>
          {/* Account — mandatory */}
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2.5">
            <div className="mb-[3px] text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">
              Account <span className="text-[var(--red)]">*</span>
            </div>
            <FinancialDropdown
              options={accountOptions}
              value={defaultAccountId ?? undefined}
              onChange={opt => onAccountChange(opt ? Number(opt.id) : null)}
              placeholder="Select account…"
              searchable
              fuse
            />
          </div>

          {rawRows.length > CSV_IMPORT_ROW_LIMIT && (
            <div className="rounded-[8px] border border-[var(--amber)] px-3 py-2 text-xs text-[var(--amber)]">
              ⚠ File has {rawRows.length} rows — only first {CSV_IMPORT_ROW_LIMIT.toLocaleString()} will be imported.
            </div>
          )}

          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card2)] p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--subtle)]">
              Column Mapping
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ColumnSelect
                label="Date"
                value={colMap.dateCol}
                headers={headers}
                onChange={v => onColMapChange({ dateCol: v })}
                required
              />

              <div className="col-span-2 sm:col-span-3">
                <div className="mb-2 flex items-center gap-3">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--subtle)]">Amount</label>
                  <div className="flex items-center gap-2">
                    {(['single', 'two'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onColMapChange({ twoColumn: mode === 'two' })}
                        className={
                          (mode === 'two') === colMap.twoColumn
                            ? 'rounded-[6px] px-2 py-0.5 text-[11px] cursor-pointer bg-[var(--accent-d)] text-[var(--accent)] font-semibold'
                            : 'rounded-[6px] px-2 py-0.5 text-[11px] cursor-pointer text-[var(--muted)]'
                        }
                      >
                        {mode === 'single' ? 'Single (signed)' : 'Debit / Credit'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {!colMap.twoColumn ? (
                    <ColumnSelect
                      label="Amount (+ income / − expense)"
                      value={colMap.amountCol}
                      headers={headers}
                      onChange={v => onColMapChange({ amountCol: v })}
                      required
                    />
                  ) : (
                    <>
                      <ColumnSelect
                        label="Debit (expense)"
                        value={colMap.debitCol}
                        headers={headers}
                        onChange={v => onColMapChange({ debitCol: v })}
                      />
                      <ColumnSelect
                        label="Credit (income)"
                        value={colMap.creditCol}
                        headers={headers}
                        onChange={v => onColMapChange({ creditCol: v })}
                      />
                    </>
                  )}
                  <ColumnSelect
                    label="Payee / Description"
                    value={colMap.payeeCol}
                    headers={headers}
                    onChange={v => onColMapChange({ payeeCol: v })}
                  />
                  <ColumnSelect
                    label="Notes / Memo"
                    value={colMap.notesCol}
                    headers={headers}
                    onChange={v => onColMapChange({ notesCol: v })}
                  />
                  <ColumnSelect
                    label="Transaction Type (optional)"
                    value={colMap.typeCol}
                    headers={headers}
                    onChange={v => onColMapChange({ typeCol: v })}
                  />
                  <ColumnSelect
                    label="Currency (optional)"
                    value={colMap.currencyCol}
                    headers={headers}
                    onChange={v => onColMapChange({ currencyCol: v })}
                  />
                  <ColumnSelect
                    label="Category (optional)"
                    value={colMap.categoryCol}
                    headers={headers}
                    onChange={v => onColMapChange({ categoryCol: v })}
                  />
                  <ColumnSelect
                    label="To Account / Transfer To (optional)"
                    value={colMap.toAccountCol}
                    headers={headers}
                    onChange={v => onColMapChange({ toAccountCol: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Transactions
        </Button>
        <Button disabled={!step1Valid} onClick={onAdvance}>
          Preview{' '}
          {rawRows.length > 0 ? `(${Math.min(rawRows.length, CSV_IMPORT_ROW_LIMIT).toLocaleString()} rows)` : ''} →
        </Button>
      </div>
    </div>
  );
}
