'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { apiFetch } from '@/lib/utils';
import type { DropdownOption } from '../../FinancialDropdown';
import { categoryIconEmoji } from '../../categoryIcons';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import type { PayeesResponse, PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { TransactionListItem, TransactionsListResponse } from '@/app/api/finances/transactions/route';
import type { ImportBatchResponse } from '@/app/api/finances/transactions/import/route';
import { TransactionTypes } from '@my-hub/shared/constants';
import {
  autoDetectColumn,
  parseDate,
  parseAmount,
  deriveType,
  isDuplicateRow,
  matchCategory,
} from './csv-import.utils';
import { CSV_IMPORT_ROW_LIMIT } from './constants';
import type { Step, ColumnMap, ImportRow, PayeeMapping, CategoryMapping } from './types';
import { UploadStep } from './UploadStep';
import { PreviewStep } from './PreviewStep';
import { ConfirmStep } from './ConfirmStep';

type CsvImportScreenProps = {
  onDone: (batchId: string, count: number) => void;
  onBack: () => void;
};

export function CsvImportScreen({ onDone, onBack }: CsvImportScreenProps) {
  // ── Load data ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<TransactionFormDataResponse | null>(null);
  const [payees, setPayees] = useState<PayeeWithSuggestion[]>([]);
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
    categoryCol: '',
    toAccountCol: '',
  });
  const [defaultAccountId, setDefaultAccountId] = useState<number | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [payeeMappings, setPayeeMappings] = useState<Map<string, PayeeMapping>>(new Map());
  const [categoryMappings, setCategoryMappings] = useState<Map<string, CategoryMapping>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  if (loadingData || !formData) {
    return <div className="flex h-48 items-center justify-center text-sm text-[var(--fin-muted)]">Loading…</div>;
  }

  // Narrowed reference so closures below see the non-null type
  const loadedFormData = formData;
  const { currency } = loadedFormData;
  const accountOptions: DropdownOption[] = loadedFormData.accounts.map(a => ({ id: a.id, value: a.name }));
  const categoryOptions: DropdownOption[] = loadedFormData.categories.map(c => ({
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

        const dateCol = autoDetectColumn(hs, [/^date$/i, /datum/i, /date/i, /data/i]);
        const amountCol = autoDetectColumn(hs, [/^amount$/i, /^sum$/i, /^value$/i, /^transaction amount$/i]);
        const debitCol = autoDetectColumn(hs, [/debit/i, /withdrawal/i, /charge/i]);
        const creditCol = autoDetectColumn(hs, [/credit/i, /deposit/i]);
        const payeeCol = autoDetectColumn(hs, [/payee/i, /merchant/i, /recipient/i, /beneficiary/i, /narrative/i]);
        const notesCol = autoDetectColumn(hs, [
          /^notes$/i,
          /^note$/i,
          /^memo$/i,
          /reference/i,
          /details/i,
          /remarks/i,
          /description/i,
        ]);
        const typeCol = autoDetectColumn(hs, [/^type$/i, /transaction type/i]);
        const currencyCol = autoDetectColumn(hs, [/^currency$/i, /^cur?r$/i, /^ccy$/i, /^iso currency/i]);
        const categoryCol = autoDetectColumn(hs, [/^category$/i, /^cat$/i]);
        const toAccountCol = autoDetectColumn(hs, [
          /to account/i,
          /destination account/i,
          /transfer to/i,
          /to_account/i,
        ]);
        const twoColumn = !amountCol && !!(debitCol || creditCol);
        setColMap({
          dateCol,
          amountCol,
          twoColumn,
          debitCol,
          creditCol,
          payeeCol,
          notesCol,
          typeCol,
          currencyCol,
          categoryCol,
          toAccountCol,
        });
      },
    });
  }

  function buildImportRows(): ImportRow[] {
    return rawRows.slice(0, CSV_IMPORT_ROW_LIMIT).map((raw, i) => {
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
      const rawCategoryName = (colMap.categoryCol ? (raw[colMap.categoryCol] ?? '') : '').trim();
      const rawToAccountName = (colMap.toAccountCol ? (raw[colMap.toAccountCol] ?? '') : '').trim();

      // Auto-match to-account by name for transfers
      let toAccountId: number | null = null;
      if (rawToAccountName) {
        const match = loadedFormData.accounts.find(a => a.name.toLowerCase() === rawToAccountName.toLowerCase());
        if (match) toAccountId = match.id;
      }

      let categoryId: number | null = null;
      if (rawCategoryName) {
        categoryId = matchCategory(rawCategoryName, loadedFormData.categories);
      } else if (!colMap.categoryCol && rawPayeeName) {
        const match = payees.find(
          p =>
            p.name.toLowerCase() === rawPayeeName.toLowerCase() ||
            p.aliases.some(a => a.toLowerCase() === rawPayeeName.toLowerCase()),
        );
        if (match?.lastUsedCategoryId) categoryId = match.lastUsedCategoryId;
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
        rawCategoryName,
        rawToAccountName,
        accountId: defaultAccountId ?? loadedFormData.accounts[0]?.id ?? 0,
        toAccountId,
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
          defaultCategoryId: match?.lastUsedCategoryId ?? null,
        });
      }
    }
    setPayeeMappings(unique);

    // Build category mappings
    const uniqueCats = new Map<string, CategoryMapping>();
    for (const row of rowsWithDupe) {
      if (row.rawCategoryName && !uniqueCats.has(row.rawCategoryName)) {
        const catId = matchCategory(row.rawCategoryName, loadedFormData.categories);
        uniqueCats.set(row.rawCategoryName, { csvValue: row.rawCategoryName, categoryId: catId });
      }
    }
    setCategoryMappings(uniqueCats);
    setStep('preview');
  }

  function updateRow(key: string, patch: Partial<ImportRow>) {
    setImportRows(prev => prev.map(r => (r._key === key ? { ...r, ...patch } : r)));
  }

  function updatePayeeMapping(csvValue: string, patch: Partial<PayeeMapping>) {
    setPayeeMappings(prev => {
      const next = new Map(prev);
      const existing = next.get(csvValue);
      if (!existing) return next;

      const updated = { ...existing, ...patch };
      next.set(csvValue, updated);

      // When payee selection changes, propagate the payee's recent category to rows with no CSV category
      if (patch.existingPayeeId !== undefined) {
        const payee = payees.find(p => p.id === patch.existingPayeeId);
        const catId = payee?.lastUsedCategoryId ?? null;
        next.set(csvValue, { ...updated, defaultCategoryId: catId });
        if (catId) {
          setImportRows(rows =>
            rows.map(r =>
              r.rawPayeeName === csvValue && !r.ignored && !r.rawCategoryName ? { ...r, categoryId: catId } : r,
            ),
          );
        }
      }

      // When defaultCategoryId changes, push it to rows with no CSV category
      if (patch.defaultCategoryId !== undefined) {
        setImportRows(rows =>
          rows.map(r =>
            r.rawPayeeName === csvValue && !r.ignored && !r.rawCategoryName
              ? { ...r, categoryId: patch.defaultCategoryId ?? null }
              : r,
          ),
        );
      }

      return next;
    });
  }

  function updateCategoryMapping(csvValue: string, categoryId: number | null) {
    setCategoryMappings(prev => {
      const next = new Map(prev);
      const existing = next.get(csvValue);
      if (!existing) return next;
      next.set(csvValue, { ...existing, categoryId });
      // Propagate to all rows with this rawCategoryName
      setImportRows(rows => rows.map(r => (r.rawCategoryName === csvValue && !r.ignored ? { ...r, categoryId } : r)));
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

      const result = await apiFetch<ImportBatchResponse>('/api/finances/transactions/import', {
        method: 'POST',
        body: { filename, rows },
      });
      onDone(result.batchId, result.importedCount);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const step1Valid =
    !!defaultAccountId &&
    !!colMap.dateCol &&
    (colMap.twoColumn ? !!(colMap.debitCol || colMap.creditCol) : !!colMap.amountCol) &&
    rawRows.length > 0;

  if (step === 'upload') {
    return (
      <UploadStep
        filename={filename}
        rawRows={rawRows}
        headers={headers}
        colMap={colMap}
        defaultAccountId={defaultAccountId}
        accountOptions={accountOptions}
        step1Valid={step1Valid}
        onFileChange={handleFile}
        onColMapChange={patch => setColMap(c => ({ ...c, ...patch }))}
        onAccountChange={setDefaultAccountId}
        onAdvance={advanceToPreview}
        onBack={onBack}
      />
    );
  }

  if (step === 'preview') {
    return (
      <PreviewStep
        importRows={importRows}
        payeeMappings={payeeMappings}
        categoryMappings={categoryMappings}
        colMap={colMap}
        currency={currency}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        payeeOptions={payeeOptions}
        accounts={loadedFormData.accounts}
        onUpdateRow={updateRow}
        onUpdatePayeeMapping={updatePayeeMapping}
        onUpdateCategoryMapping={updateCategoryMapping}
        onBack={() => setStep('upload')}
        onNext={() => setStep('confirm')}
      />
    );
  }

  return (
    <ConfirmStep
      activeRows={activeRows}
      ignoredCount={importRows.filter(r => r.ignored).length}
      filename={filename}
      currency={currency}
      rowsMissingDate={rowsMissingDate}
      transfersMissingTo={transfersMissingTo}
      nonTransferMissingCategory={nonTransferMissingCategory}
      canImport={canImport}
      submitting={submitting}
      accounts={loadedFormData.accounts}
      onImport={handleImport}
      onBack={() => setStep('preview')}
    />
  );
}
