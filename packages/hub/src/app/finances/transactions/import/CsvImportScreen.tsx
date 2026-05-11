'use client';

import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { FinancialDropdown } from '../../FinancialDropdown';
import type { DropdownOption } from '../../FinancialDropdown';
import { Button } from '@/components';
import { fmt } from '../../ui';
import { categoryIconEmoji } from '../../categoryIcons';
import type {
  TransactionFormDataResponse,
  PayeeSuggestion,
  TransactionListItem,
  TransactionsListResponse,
  PayeesResponse,
} from '@/app/api/finances/contracts';
import { TransactionTypes, type TransactionType, SupportedCurrencies } from '@my-hub/shared/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'confirm';

interface ColumnMap {
  dateCol: string;
  amountCol: string;
  twoColumn: boolean;
  debitCol: string;
  creditCol: string;
  payeeCol: string;
  notesCol: string;
  typeCol: string;
  currencyCol: string;
}

interface ImportRow {
  _key: string;
  ignored: boolean;
  type: TransactionType;
  date: string; // YYYY-MM-DD, empty string if parsing failed
  rawDate: string; // original CSV value, shown in error state
  amount: number; // always positive
  csvCurrency: string; // raw value from CSV currency column (may be empty)
  rawPayeeName: string;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  notes: string;
  isDuplicate: boolean;
}

type PayeeAction = 'existing' | 'create' | 'unmapped';

interface PayeeMapping {
  csvValue: string;
  action: PayeeAction;
  existingPayeeId: number | null;
  existingPayeeName: string | null;
  newPayeeName: string;
  addAlias: boolean;
  defaultCategoryId: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoDetectColumn(headers: string[], patterns: RegExp[]): string {
  for (const header of headers) {
    for (const pattern of patterns) {
      if (pattern.test(header)) return header;
    }
  }
  return '';
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // YYYYMMDD compact
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]!}-${compact[2]!}-${compact[3]!}`;
  const dmy = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) return `${dmy[3]!}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]!}-${mdy[1]!.padStart(2, '0')}-${mdy[2]!.padStart(2, '0')}`;
  return null;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^0-9.,-]/g, '');
  const normalized = cleaned.replace(/\.(?=\d{3}(,|$))/g, '').replace(',', '.');
  const val = parseFloat(normalized);
  return isNaN(val) ? null : val;
}

function deriveType(signed: number, typeRaw?: string): TransactionType {
  if (typeRaw) {
    const t = typeRaw.trim().toLowerCase();
    if (t === 'transfer' || t === 'tra') return TransactionTypes.Transfer;
    if (t === 'income' || t === 'credit' || t === 'inc') return TransactionTypes.Income;
    if (t === 'expense' || t === 'debit' || t === 'exp') return TransactionTypes.Expense;
  }
  return signed >= 0 ? TransactionTypes.Income : TransactionTypes.Expense;
}

function isDuplicateRow(row: ImportRow, existing: TransactionListItem[]): boolean {
  return existing.some(t => t.date === row.date && Math.abs(t.amount - row.amount) < 0.001 && t.type === row.type);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColumnSelect({
  label,
  value,
  headers,
  onChange,
  placeholder = '— skip —',
  required,
}: {
  label: string;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-[var(--fin-subtle)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--fin-red)]">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-[8px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-2 py-1.5 text-xs text-[var(--fin-text)] focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {headers.map(h => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

function TypeToggle({ value, onChange }: { value: TransactionType; onChange: (t: TransactionType) => void }) {
  const types = [
    { key: TransactionTypes.Expense, label: 'E' },
    { key: TransactionTypes.Income, label: 'I' },
    { key: TransactionTypes.Transfer, label: 'T' },
  ] as const;

  return (
    <div className="flex rounded-[6px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-[2px]">
      {types.map(({ key, label }) => {
        const active = value === key;
        const color =
          key === TransactionTypes.Expense
            ? 'var(--fin-red)'
            : key === TransactionTypes.Income
              ? 'var(--fin-green)'
              : 'var(--fin-blue)';
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="w-6 rounded-[4px] py-0.5 text-[10px] font-bold transition-colors cursor-pointer"
            style={active ? { background: color + '22', color } : { color: 'var(--fin-muted)' }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type CsvImportScreenProps = {
  onDone: (batchId: string, count: number) => void;
  onBack: () => void;
};

export function CsvImportScreen({ onDone, onBack }: CsvImportScreenProps) {
  // ── Load data ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<TransactionFormDataResponse | null>(null);
  const [payees, setPayees] = useState<PayeeSuggestion[]>([]);
  const [existingTransactions, setExistingTransactions] = useState<TransactionListItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [fd, pr, tr] = await Promise.all([
          apiFetch<TransactionFormDataResponse>('/api/finances/transactions/form-data', { silentToast: true }),
          apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true }),
          apiFetch<TransactionsListResponse>('/api/finances/transactions?limit=200&offset=0', { silentToast: true }),
        ]);
        setFormData(fd);
        setPayees(pr.payees);
        setExistingTransactions(tr.transactions);
      } finally {
        setLoadingData(false);
      }
    }
    void loadData();
  }, []);

  // ── Wizard state ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({
    dateCol: '',
    amountCol: '',
    twoColumn: false,
    debitCol: '',
    creditCol: '',
    payeeCol: '',
    notesCol: '',
    typeCol: '',
    currencyCol: '',
  });
  const [defaultAccountId, setDefaultAccountId] = useState<number | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [payeeMappings, setPayeeMappings] = useState<Map<string, PayeeMapping>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loadingData || !formData) {
    return <div className="flex h-48 items-center justify-center text-sm text-[var(--fin-muted)]">Loading…</div>;
  }

  const { currency } = formData;
  const accountOptions: DropdownOption[] = formData.accounts.map(a => ({ id: a.id, value: a.name }));
  const categoryOptions: DropdownOption[] = formData.categories.map(c => ({
    id: c.id,
    value: `${categoryIconEmoji(c.icon)} ${c.name}`.trim(),
  }));
  const payeeOptions: DropdownOption[] = payees.map(p => ({ id: p.id, value: p.name }));

  // ── Step 1 handlers ────────────────────────────────────────────────────────
  function handleFile(file: File) {
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        const hs = result.meta.fields ?? [];
        setHeaders(hs);
        setRawRows(result.data);

        const dateCol = autoDetectColumn(hs, [/^date$/i, /datum/i, /дата/i, /date/i]);
        const amountCol = autoDetectColumn(hs, [/^amount$/i, /^sum$/i, /^value$/i, /^transaction amount$/i]);
        const debitCol = autoDetectColumn(hs, [/debit/i, /withdrawal/i, /charge/i]);
        const creditCol = autoDetectColumn(hs, [/credit/i, /deposit/i]);
        const payeeCol = autoDetectColumn(hs, [
          /payee/i,
          /description/i,
          /merchant/i,
          /recipient/i,
          /beneficiary/i,
          /narrative/i,
        ]);
        const notesCol = autoDetectColumn(hs, [/^notes$/i, /^memo$/i, /reference/i, /details/i, /remarks/i]);
        const typeCol = autoDetectColumn(hs, [/^type$/i, /transaction type/i]);
        const currencyCol = autoDetectColumn(hs, [/^currency$/i, /^curr$/i, /^ccy$/i, /^iso currency/i]);
        const twoColumn = !amountCol && !!(debitCol || creditCol);
        setColMap({ dateCol, amountCol, twoColumn, debitCol, creditCol, payeeCol, notesCol, typeCol, currencyCol });
      },
    });
  }

  function buildImportRows(): ImportRow[] {
    return rawRows.slice(0, 1000).map((raw, i) => {
      const dateRaw = colMap.dateCol ? (raw[colMap.dateCol] ?? '') : '';
      const date = parseDate(dateRaw) ?? '';

      let signed: number;
      if (colMap.twoColumn) {
        const debit = parseAmount(colMap.debitCol ? (raw[colMap.debitCol] ?? '') : '') ?? 0;
        const credit = parseAmount(colMap.creditCol ? (raw[colMap.creditCol] ?? '') : '') ?? 0;
        signed = credit > 0 ? credit : -debit;
      } else {
        signed = parseAmount(colMap.amountCol ? (raw[colMap.amountCol] ?? '') : '') ?? 0;
      }

      const amount = Math.abs(signed);
      const typeRaw = colMap.typeCol ? (raw[colMap.typeCol] ?? '') : '';
      const type = deriveType(signed, typeRaw);
      const rawPayeeName = (colMap.payeeCol ? (raw[colMap.payeeCol] ?? '') : '').trim();
      const notes = (colMap.notesCol ? (raw[colMap.notesCol] ?? '') : '').trim();
      const csvCurrency = (colMap.currencyCol ? (raw[colMap.currencyCol] ?? '') : '').trim().toUpperCase();

      let categoryId: number | null = null;
      if (rawPayeeName) {
        const match = payees.find(
          p =>
            p.name.toLowerCase() === rawPayeeName.toLowerCase() ||
            p.aliases.some(a => a.toLowerCase() === rawPayeeName.toLowerCase()),
        );
        if (match?.recentCategoryId) categoryId = match.recentCategoryId;
      }

      return {
        _key: `row-${i}`,
        ignored: false,
        type,
        date,
        rawDate: dateRaw,
        amount,
        csvCurrency,
        rawPayeeName,
        accountId: defaultAccountId ?? formData!.accounts[0]?.id ?? 0,
        toAccountId: null,
        categoryId,
        notes,
        isDuplicate: false,
      };
    });
  }

  function advanceToPreview() {
    const rows = buildImportRows();
    const rowsWithDupe = rows.map(r => ({ ...r, isDuplicate: isDuplicateRow(r, existingTransactions) }));
    setImportRows(rowsWithDupe);

    const unique = new Map<string, PayeeMapping>();
    for (const row of rowsWithDupe) {
      if (row.rawPayeeName && !unique.has(row.rawPayeeName)) {
        const match = payees.find(
          p =>
            p.name.toLowerCase() === row.rawPayeeName.toLowerCase() ||
            p.aliases.some(a => a.toLowerCase() === row.rawPayeeName.toLowerCase()),
        );
        unique.set(row.rawPayeeName, {
          csvValue: row.rawPayeeName,
          action: match ? 'existing' : 'create',
          existingPayeeId: match?.id ?? null,
          existingPayeeName: match?.name ?? null,
          newPayeeName: row.rawPayeeName,
          addAlias: !match,
          defaultCategoryId: match?.recentCategoryId ?? null,
        });
      }
    }
    setPayeeMappings(unique);
    setStep('preview');
  }

  function updateRow(key: string, patch: Partial<ImportRow>) {
    setImportRows(prev => prev.map(r => (r._key === key ? { ...r, ...patch } : r)));
  }

  function updatePayeeMapping(csvValue: string, patch: Partial<PayeeMapping>) {
    setPayeeMappings(prev => {
      const next = new Map(prev);
      const existing = next.get(csvValue);
      if (existing) {
        const updated = { ...existing, ...patch };
        next.set(csvValue, updated);

        // When payee selection changes, propagate the payee's recent category
        if (patch.existingPayeeId !== undefined) {
          const payee = payees.find(p => p.id === patch.existingPayeeId);
          const catId = payee?.recentCategoryId ?? null;
          next.set(csvValue, { ...updated, defaultCategoryId: catId });
          if (catId) {
            setImportRows(rows =>
              rows.map(r => (r.rawPayeeName === csvValue && !r.ignored ? { ...r, categoryId: catId } : r)),
            );
          }
        }

        // When defaultCategoryId changes, push it to all matching rows
        if (patch.defaultCategoryId !== undefined) {
          setImportRows(rows =>
            rows.map(r =>
              r.rawPayeeName === csvValue && !r.ignored ? { ...r, categoryId: patch.defaultCategoryId ?? null } : r,
            ),
          );
        }
      }
      return next;
    });
  }

  const activeRows = importRows.filter(r => !r.ignored);
  const rowsMissingDate = activeRows.filter(r => !r.date);
  const transfersMissingTo = activeRows.filter(r => r.type === TransactionTypes.Transfer && !r.toAccountId);
  const nonTransferMissingCategory = activeRows.filter(r => r.type === TransactionTypes.Expense && !r.categoryId);
  const canImport =
    rowsMissingDate.length === 0 && transfersMissingTo.length === 0 && nonTransferMissingCategory.length === 0;

  async function handleImport() {
    if (!canImport || submitting) return;
    setSubmitting(true);
    try {
      const rows = activeRows.map(row => {
        const mapping = payeeMappings.get(row.rawPayeeName);
        let payeeId: number | null = null;
        let payeeName: string | undefined;
        let payeeAlias: string | undefined;

        if (mapping?.action === 'existing' && mapping.existingPayeeId) {
          payeeId = mapping.existingPayeeId;
        } else if (mapping?.action === 'create' && mapping.newPayeeName.trim()) {
          payeeName = mapping.newPayeeName.trim();
          if (mapping.addAlias && row.rawPayeeName !== payeeName) {
            payeeAlias = row.rawPayeeName;
          }
        }

        return {
          type: row.type,
          date: row.date,
          amount: row.amount,
          accountId: row.accountId,
          toAccountId: row.toAccountId ?? null,
          categoryId: row.categoryId ?? null,
          payeeId: payeeId !== null ? payeeId : undefined,
          payeeName,
          payeeAlias,
          notes: row.notes || undefined,
        };
      });

      const result = await apiFetch<{ batchId: string; importedCount: number }>('/api/finances/transactions/import', {
        method: 'POST',
        body: { filename, rows },
      });
      onDone(result.batchId, result.importedCount);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 1 UI ──────────────────────────────────────────────────────────────
  const step1Valid =
    !!defaultAccountId &&
    !!colMap.dateCol &&
    (colMap.twoColumn ? !!(colMap.debitCol || colMap.creditCol) : !!colMap.amountCol) &&
    rawRows.length > 0;

  if (step === 'upload') {
    return (
      <div className="flex flex-col gap-4">
        {/* File picker */}
        <div
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[var(--fin-border)] p-8 text-center transition-colors hover:border-[var(--fin-accent)]"
        >
          <div className="text-2xl">📂</div>
          <div className="text-sm font-medium text-[var(--fin-text)]">
            {filename ? filename : 'Click to select a CSV file'}
          </div>
          {rawRows.length > 0 && <div className="text-xs text-[var(--fin-muted)]">{rawRows.length} rows detected</div>}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Account + column mapping — shown only after file is loaded */}
        {rawRows.length > 0 && (
          <>
            {/* Account — mandatory */}
            <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2.5">
              <div className="mb-[3px] text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">
                Account <span className="text-[var(--fin-red)]">*</span>
              </div>
              <FinancialDropdown
                options={accountOptions}
                value={defaultAccountId ?? undefined}
                onChange={opt => setDefaultAccountId(opt ? Number(opt.id) : null)}
                placeholder="Select account…"
                searchable
                fuse
              />
            </div>
            {rawRows.length > 1000 && (
              <div className="rounded-[8px] border border-[var(--fin-amber)] px-3 py-2 text-xs text-[var(--fin-amber)]">
                ⚠ File has {rawRows.length} rows — only first 1,000 will be imported.
              </div>
            )}

            <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fin-subtle)]">
                Column Mapping
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <ColumnSelect
                  label="Date"
                  value={colMap.dateCol}
                  headers={headers}
                  onChange={v => setColMap(c => ({ ...c, dateCol: v }))}
                  required
                />

                <div className="col-span-2 sm:col-span-3">
                  <div className="mb-2 flex items-center gap-3">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--fin-subtle)]">Amount</label>
                    <div className="flex items-center gap-2">
                      {(['single', 'two'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setColMap(c => ({ ...c, twoColumn: mode === 'two' }))}
                          className={cn(
                            'rounded-[6px] px-2 py-0.5 text-[11px] cursor-pointer',
                            (mode === 'two') === colMap.twoColumn
                              ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)] font-semibold'
                              : 'text-[var(--fin-muted)]',
                          )}
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
                        onChange={v => setColMap(c => ({ ...c, amountCol: v }))}
                        required
                      />
                    ) : (
                      <>
                        <ColumnSelect
                          label="Debit (expense)"
                          value={colMap.debitCol}
                          headers={headers}
                          onChange={v => setColMap(c => ({ ...c, debitCol: v }))}
                        />
                        <ColumnSelect
                          label="Credit (income)"
                          value={colMap.creditCol}
                          headers={headers}
                          onChange={v => setColMap(c => ({ ...c, creditCol: v }))}
                        />
                      </>
                    )}
                    <ColumnSelect
                      label="Payee / Description"
                      value={colMap.payeeCol}
                      headers={headers}
                      onChange={v => setColMap(c => ({ ...c, payeeCol: v }))}
                    />
                    <ColumnSelect
                      label="Notes / Memo"
                      value={colMap.notesCol}
                      headers={headers}
                      onChange={v => setColMap(c => ({ ...c, notesCol: v }))}
                    />
                    <ColumnSelect
                      label="Transaction Type (optional)"
                      value={colMap.typeCol}
                      headers={headers}
                      onChange={v => setColMap(c => ({ ...c, typeCol: v }))}
                    />
                    <ColumnSelect
                      label="Currency (optional)"
                      value={colMap.currencyCol}
                      headers={headers}
                      onChange={v => setColMap(c => ({ ...c, currencyCol: v }))}
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
          <Button disabled={!step1Valid} onClick={advanceToPreview}>
            Preview {rawRows.length > 0 ? `(${Math.min(rawRows.length, 1000)} rows)` : ''} →
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2 UI ──────────────────────────────────────────────────────────────
  const uniquePayeeValues = Array.from(
    new Set(importRows.filter(r => !r.ignored && r.rawPayeeName).map(r => r.rawPayeeName)),
  );

  if (step === 'preview') {
    const payeeStats = {
      matched: Array.from(payeeMappings.values()).filter(m => m.action === 'existing' && m.existingPayeeId).length,
      created: Array.from(payeeMappings.values()).filter(m => m.action === 'create').length,
      skipped: Array.from(payeeMappings.values()).filter(m => m.action === 'unmapped').length,
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Summary */}
        <div className="text-[13px] text-[var(--fin-muted)]">
          {importRows.length} rows · {currency}
        </div>

        {/* Side-by-side: payee mapping left, transaction table right */}
        <div className="flex gap-4 items-start">
          {/* ── Left: payee mapping panel ── */}
          {uniquePayeeValues.length > 0 && (
            <div className="w-[300px] flex-shrink-0 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] overflow-hidden">
              {/* Header */}
              <div className="border-b border-[var(--fin-border)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[var(--fin-text)]">Payee mapping</div>
                  <div className="flex gap-1.5 text-[10px] text-[var(--fin-muted)] flex-shrink-0">
                    <span>{payeeStats.matched} matched</span>
                    <span>·</span>
                    <span>{payeeStats.created} new</span>
                    <span>·</span>
                    <span>{payeeStats.skipped} skipped</span>
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--fin-muted)]">Match, create, or skip each CSV payee.</div>
              </div>

              {/* Scrollable rows */}
              <div className="max-h-[600px] overflow-y-auto divide-y divide-[var(--fin-border)]">
                {uniquePayeeValues.map(csvValue => {
                  const mapping = payeeMappings.get(csvValue);
                  if (!mapping) return null;
                  const autoMatched = mapping.action === 'existing' && mapping.existingPayeeId !== null;
                  return (
                    <div key={csvValue} className="flex flex-col gap-2 px-3 py-2.5">
                      {/* CSV value */}
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--fin-text)]"
                          title={csvValue}
                        >
                          {csvValue}
                        </span>
                        {autoMatched && (
                          <span className="flex-shrink-0 text-[9px] text-[var(--fin-green)]">● matched</span>
                        )}
                      </div>

                      {/* Match / Create / Skip toggle */}
                      <div className="flex overflow-hidden rounded-[6px] border border-[var(--fin-border)] text-[10px]">
                        {(['existing', 'create', 'unmapped'] as PayeeAction[]).map(action => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => updatePayeeMapping(csvValue, { action })}
                            className={cn(
                              'flex-1 py-1 cursor-pointer transition-colors',
                              mapping.action === action
                                ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)] font-semibold'
                                : 'text-[var(--fin-muted)] hover:text-[var(--fin-text)]',
                            )}
                          >
                            {action === 'unmapped' ? 'Skip' : action === 'existing' ? 'Match' : 'Create'}
                          </button>
                        ))}
                      </div>

                      {/* Resolution inputs */}
                      {mapping.action === 'existing' && (
                        <div className="flex flex-col gap-1.5">
                          <FinancialDropdown
                            options={payeeOptions}
                            value={mapping.existingPayeeId ?? undefined}
                            onChange={opt =>
                              updatePayeeMapping(csvValue, {
                                existingPayeeId: opt ? Number(opt.id) : null,
                                existingPayeeName: opt ? String(opt.value) : null,
                              })
                            }
                            placeholder="Select payee…"
                            searchable
                            fuse
                            inputClassName="text-xs"
                          />
                          <FinancialDropdown
                            options={categoryOptions}
                            value={mapping.defaultCategoryId ?? undefined}
                            onChange={opt =>
                              updatePayeeMapping(csvValue, { defaultCategoryId: opt ? Number(opt.id) : null })
                            }
                            placeholder="Default category…"
                            searchable
                            fuse
                            clearable
                            inputClassName="text-xs"
                          />
                        </div>
                      )}

                      {mapping.action === 'create' && (
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text"
                            value={mapping.newPayeeName}
                            onChange={e => updatePayeeMapping(csvValue, { newPayeeName: e.target.value })}
                            placeholder="Canonical name…"
                            className="w-full rounded-[6px] border border-[var(--fin-border)] bg-[var(--fin-card)] px-2 py-1 text-xs text-[var(--fin-text)] outline-none"
                          />
                          <FinancialDropdown
                            options={categoryOptions}
                            value={mapping.defaultCategoryId ?? undefined}
                            onChange={opt =>
                              updatePayeeMapping(csvValue, { defaultCategoryId: opt ? Number(opt.id) : null })
                            }
                            placeholder="Default category…"
                            searchable
                            fuse
                            clearable
                            inputClassName="text-xs"
                          />
                          {mapping.newPayeeName !== csvValue && (
                            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-[var(--fin-muted)]">
                              <input
                                type="checkbox"
                                checked={mapping.addAlias}
                                onChange={e => updatePayeeMapping(csvValue, { addAlias: e.target.checked })}
                              />
                              Save "{csvValue}" as alias
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Right: transaction table ── */}
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
                          onChange={e => updateRow(row._key, { ignored: e.target.checked })}
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
                          {row.csvCurrency ? (
                            (() => {
                              const isSupported = (SupportedCurrencies as readonly string[]).includes(row.csvCurrency);
                              const accountCurrency =
                                formData.accounts.find(a => a.id === row.accountId)?.currency ?? '';
                              const mismatch = isSupported && accountCurrency && row.csvCurrency !== accountCurrency;
                              return (
                                <span
                                  className="font-mono text-[11px]"
                                  style={{
                                    color: !isSupported
                                      ? 'var(--fin-red)'
                                      : mismatch
                                        ? 'var(--fin-amber)'
                                        : 'var(--fin-text)',
                                  }}
                                  title={
                                    !isSupported
                                      ? `Unsupported currency: ${row.csvCurrency}`
                                      : mismatch
                                        ? `Currency mismatch: CSV says ${row.csvCurrency}, account is ${accountCurrency}`
                                        : undefined
                                  }
                                >
                                  {row.csvCurrency}
                                  {(!isSupported || mismatch) && ' ⚠'}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-[var(--fin-muted)]">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-1.5 pr-2">
                        <TypeToggle value={row.type} onChange={t => updateRow(row._key, { type: t })} />
                      </td>
                      <td className="min-w-[130px] py-1.5 pr-2">
                        <div className="flex flex-col gap-1">
                          <FinancialDropdown
                            options={accountOptions}
                            value={row.accountId}
                            onChange={opt => updateRow(row._key, { accountId: opt ? Number(opt.id) : row.accountId })}
                            searchable
                            fuse
                            inputClassName="text-xs py-0.5"
                          />
                          {row.type === TransactionTypes.Transfer && (
                            <FinancialDropdown
                              options={accountOptions.filter(o => o.id !== row.accountId)}
                              value={row.toAccountId ?? undefined}
                              onChange={opt => updateRow(row._key, { toAccountId: opt ? Number(opt.id) : null })}
                              placeholder="To account…"
                              searchable
                              fuse
                              inputClassName={cn(
                                'text-xs py-0.5',
                                !row.toAccountId && 'border border-[var(--fin-red)]',
                              )}
                            />
                          )}
                        </div>
                      </td>
                      <td className="min-w-[130px] py-1.5 pr-2">
                        {row.type !== TransactionTypes.Transfer ? (
                          <FinancialDropdown
                            options={categoryOptions}
                            value={row.categoryId ?? undefined}
                            onChange={opt => updateRow(row._key, { categoryId: opt ? Number(opt.id) : null })}
                            placeholder="Category…"
                            searchable
                            fuse
                            clearable
                            inputClassName={cn(
                              'text-xs py-0.5',
                              row.type === TransactionTypes.Expense &&
                                !row.categoryId &&
                                'border border-[var(--fin-red)]',
                            )}
                          />
                        ) : (
                          <span className="text-[var(--fin-muted)]">—</span>
                        )}
                      </td>
                      <td className="min-w-[100px] py-1.5 pr-3">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={e => updateRow(row._key, { notes: e.target.value })}
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
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setStep('upload')}>
            ← Back
          </Button>
          <Button onClick={() => setStep('confirm')}>Review →</Button>
        </div>
      </div>
    );
  }

  // ── Step 3 UI ──────────────────────────────────────────────────────────────
  const ignoredCount = importRows.filter(r => r.ignored).length;

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
          ✗ {nonTransferMissingCategory.length} row{nonTransferMissingCategory.length !== 1 ? 's are' : ' is'} missing a
          category — go back and assign one.
        </div>
      )}
      {activeRows.filter(r => r.isDuplicate).length > 0 && (
        <div className="rounded-[8px] border border-[var(--fin-amber)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-amber)]">
          ⚠ {activeRows.filter(r => r.isDuplicate).length} row
          {activeRows.filter(r => r.isDuplicate).length !== 1 ? 's look' : ' looks'} like potential duplicates.
        </div>
      )}
      {(() => {
        const unsupported = activeRows.filter(
          r => r.csvCurrency && !(SupportedCurrencies as readonly string[]).includes(r.csvCurrency),
        );
        if (!unsupported.length) return null;
        const codes = [...new Set(unsupported.map(r => r.csvCurrency))].join(', ');
        return (
          <div className="rounded-[8px] border border-[var(--fin-red)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-red)]">
            ✗ {unsupported.length} row{unsupported.length !== 1 ? 's have' : ' has'} an unsupported currency ({codes}).
            Supported: {SupportedCurrencies.join(', ')}.
          </div>
        );
      })()}
      {(() => {
        const mismatched = activeRows.filter(r => {
          if (!r.csvCurrency) return false;
          const acctCurrency = formData.accounts.find(a => a.id === r.accountId)?.currency ?? '';
          return acctCurrency && r.csvCurrency !== acctCurrency;
        });
        if (!mismatched.length) return null;
        return (
          <div className="rounded-[8px] border border-[var(--fin-amber)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-amber)]">
            ⚠ {mismatched.length} row{mismatched.length !== 1 ? 's have' : ' has'} a currency that does not match the
            selected account's currency.
          </div>
        );
      })()}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep('preview')}>
          ← Back
        </Button>
        <Button disabled={!canImport || submitting} onClick={handleImport}>
          {submitting ? 'Importing…' : `Import ${activeRows.length} transactions`}
        </Button>
      </div>
    </div>
  );
}
