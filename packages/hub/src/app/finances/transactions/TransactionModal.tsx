'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn, apiFetch } from '@/lib/utils';
import { FinancialDropdown } from '../FinancialDropdown';
import { FinModalShell } from '../FinModalShell';
import { Button, Input, Pill } from '@/components';
import { categoryIconEmoji } from '../categoryIcons';
import { AddTransactionSchema, defaultAddTransactionValues, type AddTransactionValues } from '../finances-form.schema';
import { useAmountMask } from './useAmountMask';
import { MobileAmountKeypad } from './MobileAmountKeypad';
import { LabelMultiSelect } from './LabelMultiSelect';
import type { PayeesResponse, PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import type { TransactionDetail, TransactionMutationResponse } from '@/app/api/finances/transactions/[id]/route';
import type { LabelsResponse } from '@/app/api/finances/labels/route';
import { getCurrencySymbol, isPayeeRequired, localDateString } from '@my-hub/shared/utils';
import { EXPENSE_ACCOUNT_TYPES, TransactionType, TransactionTypes } from '@my-hub/shared/constants';
import { FinFieldCard, renderAccountOption } from '../ui';
import { finDropdownInputClass } from '../finances.utils';

const TYPE_COLORS: Record<TransactionType, string> = {
  [TransactionTypes.Expense]: 'var(--fin-red)',
  [TransactionTypes.Income]: 'var(--fin-green)',
  [TransactionTypes.Transfer]: 'var(--fin-blue)',
};

const MOBILE_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionTypes.Expense]: '- Outflow',
  [TransactionTypes.Income]: '+ Inflow',
  [TransactionTypes.Transfer]: '⇄ Transfer',
};

function formatMobileAmount(value: string, currencyCode: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return `0.00${currencyCode}`;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + currencyCode;
}

/** Format raw cents (e.g. "110050") as a currency-suffixed string: "1,100.50MDL". */
function formatDigitsWithCurrency(digits: string, currency: string): string {
  const n = digits ? parseInt(digits, 10) / 100 : 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + currency;
}

/** Format raw cents without trailing zeros for the compact expression strip: "1100.50" → "1100.5". */
function formatDigitsCompact(digits: string): string {
  if (!digits) return '0';
  const n = parseInt(digits, 10) / 100;
  return n.toFixed(2).replace(/\.?0+$/, '');
}

function MobileFieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
      <div className="w-20 shrink-0 text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type TransactionModalProps = {
  onCloseAction: () => void;
  onSavedAction: (result?: TransactionMutationResponse) => void;
  /** When provided the modal opens in edit mode, pre-populated with that transaction's data. */
  editId?: number;
  initialType?: TransactionType;
  lockedType?: boolean;
  prefilledToAccountId?: number;
  prefilledToAccountName?: string;
};

export function TransactionModal({
  onCloseAction,
  onSavedAction,
  editId,
  initialType,
  lockedType = false,
  prefilledToAccountId,
  prefilledToAccountName,
}: TransactionModalProps) {
  const isEdit = editId !== undefined;

  const [formData, setFormData] = useState<TransactionFormDataResponse | null>(null);
  const [payees, setPayees] = useState<PayeeWithSuggestion[]>([]);
  const [allLabels, setAllLabels] = useState<string[]>([]);
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [selAccId, setSelAccId] = useState<number | null>(null);
  const [selToAccId, setSelToAccId] = useState<number | null>(prefilledToAccountId ?? null);
  const [selPayeeId, setSelPayeeId] = useState<number | null>(null);
  const [extraPayees, setExtraPayees] = useState<{ id: number; name: string }[]>([]);

  const [keypadOpen, setKeypadOpen] = useState(!isEdit);
  const [preKeypadAmount, setPreKeypadAmount] = useState('');

  const {
    displayValue: amountDisplay,
    rawDigits,
    tokens,
    expressionResult,
    handleKeyDown: amountKeyDown,
    handlePaste: amountPaste,
    setFromAmount,
    pressKey,
  } = useAmountMask();

  const mostUsedPayees = useMemo(() => {
    return [...payees]
      .filter(p => p.useCount > 0)
      .sort(
        (a, b) =>
          b.useCount - a.useCount || new Date(b.lastUsedAt ?? '').getTime() - new Date(a.lastUsedAt ?? '').getTime(),
      )
      .slice(0, 5);
  }, [payees]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<AddTransactionValues>({
    resolver: zodResolver(AddTransactionSchema),
    defaultValues: {
      ...defaultAddTransactionValues,
      txType: initialType ?? TransactionTypes.Expense,
      date: localDateString(),
    },
  });

  useEffect(() => {
    setValue('amount', amountDisplay);
  }, [amountDisplay, setValue]);

  const txType = watch('txType');
  const payeeRequired = isPayeeRequired(txType);

  const load = useCallback(async () => {
    // In edit mode, fetch the transaction first so we know which archived accounts to include in form-data
    const detail = isEdit
      ? await apiFetch<TransactionDetail>(`/api/finances/transactions/${editId}`, { silentToast: true })
      : null;

    const [fd, pd, labelsData] = await Promise.all([
      apiFetch<TransactionFormDataResponse>('/api/finances/transactions/form-data', {
        silentToast: true,
        query: detail ? { accountId: detail.accountId, toAccountId: detail.toAccountId ?? undefined } : undefined,
      }),
      apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true }),
      apiFetch<LabelsResponse>('/api/finances/labels', { silentToast: true }),
    ]);

    setFormData(fd);
    if (pd) setPayees(pd.payees);
    if (labelsData) setAllLabels(labelsData.labels);

    if (detail) {
      setValue('txType', detail.type);
      setFromAmount(String(detail.amount));
      setValue('date', detail.date);
      setValue('payee', detail.payeeName ?? '');
      setValue('note', detail.notes ?? '');
      setValue('labels', detail.labels ?? []);
      setSelPayeeId(detail.payeeId ?? null);

      setSelAccId(detail.accountId);

      if (detail.toAccountId != null) {
        setSelToAccId(detail.toAccountId);
      }

      if (detail.categoryId != null) {
        setSelCatId(detail.categoryId);
      }
    }
  }, [editId, isEdit, setValue, setFromAmount]);

  useEffect(() => {
    load();
  }, [load]);

  function selectPayee(p: PayeeWithSuggestion) {
    setValue('payee', p.name);
    setSelPayeeId(p.id);
    if (p.lastUsedCategoryId != null && formData) {
      setSelCatId(p.lastUsedCategoryId);
    }
    if (p.lastUsedAccountId != null && formData) {
      const acc = formData.accounts.find(a => a.id === p.lastUsedAccountId);
      if (acc) {
        setSelAccId(acc.id);
      }
    }
  }

  const typeColor = TYPE_COLORS[txType];

  const payeeCreateOption = useMemo(
    () => ({
      onCreate: (name: string) => {
        const tempId = -Date.now();
        setExtraPayees(prev => [...prev, { id: tempId, name }]);
        setSelPayeeId(tempId);
        setValue('payee', name);
      },
    }),
    [setValue],
  );

  async function onSubmit(values: AddTransactionValues) {
    if (!selAccId) return;
    if (txType === TransactionTypes.Expense && !selCatId) return;
    const body = {
      type: values.txType,
      accountId: selAccId,
      // Always send toAccountId so edits that change type from transfer→expense clear it
      toAccountId: txType === TransactionTypes.Transfer ? selToAccId : null,
      amount: parseFloat(values.amount),
      date: values.date,
      categoryId: selCatId,
      payeeName: values.payee.trim() || undefined,
      notes: values.note.trim() || undefined,
      labels: values.labels,
    };

    if (isEdit) {
      const result = await apiFetch<TransactionMutationResponse>(`/api/finances/transactions/${editId}`, {
        method: 'PATCH',
        body,
      });
      onSavedAction(result);
    } else {
      const result = await apiFetch<TransactionMutationResponse>('/api/finances/transactions', {
        method: 'POST',
        body,
        silentToast: true,
      });
      onSavedAction(result);
    }
  }

  const isSubmitDisabled =
    !watch('amount') || !selAccId || (txType === TransactionTypes.Expense && !selCatId) || isSubmitting;

  const currencyCode = formData?.currency ?? '';
  const currencySymbol = formData ? getCurrencySymbol(formData.currency ?? '') : '';

  const mobileAmountText = useMemo(
    () => (amountDisplay ? formatMobileAmount(amountDisplay, currencyCode) : `0.00${currencyCode}`),
    [amountDisplay, currencyCode],
  );

  // Flat token list for display — omit rawDigits when empty so a trailing operator
  // ("11 +") doesn't render a phantom "0.00MDL" as the next term.
  const expressionTerms = useMemo(
    () => (tokens.length === 0 ? null : rawDigits ? [...tokens, rawDigits] : tokens),
    [tokens, rawDigits],
  );

  // Large display: each term with currency code, wraps naturally. "0.22MDL + 5,521.17MDL - …"
  const largeExpression = useMemo(
    () =>
      expressionTerms?.map(t => (t === '+' || t === '-' ? t : formatDigitsWithCurrency(t, currencyCode))).join(' ') ??
      null,
    [expressionTerms, currencyCode],
  );

  // Compact strip inside the keypad: "0.22 + 5521.17 - …"
  const expressionText = useMemo(
    () => expressionTerms?.map(t => (t === '+' || t === '-' ? t : formatDigitsCompact(t))).join(' '),
    [expressionTerms],
  );

  const accountOptions = useMemo(() => {
    const base =
      txType === TransactionTypes.Expense
        ? (formData?.accounts ?? []).filter(a => EXPENSE_ACCOUNT_TYPES.has(a.type as never))
        : (formData?.accounts ?? []);
    const active = base.filter(a => !a.archived);
    const archived = base.filter(a => a.archived);
    return [
      ...active.map(a => ({ id: a.id, value: a.name })),
      ...archived.map(a => ({ id: a.id, value: `${a.name} (archived)` })),
    ];
  }, [txType, formData?.accounts]);

  const categoryOptions = useMemo(
    () =>
      formData?.categories.map(c => ({
        id: c.id,
        value: `${categoryIconEmoji(c.icon)} ${c.name}`.trim(),
      })) ?? [],
    [formData?.categories],
  );

  const toAccountOptions = useMemo(() => {
    const base = (formData?.accounts ?? []).filter(a => a.id !== selAccId);
    const active = base.filter(a => !a.archived);
    const archived = base.filter(a => a.archived);
    return [
      ...active.map(a => ({ id: a.id, value: a.name })),
      ...archived.map(a => ({ id: a.id, value: `${a.name} (archived)` })),
    ];
  }, [formData?.accounts, selAccId]);

  const payeeOptions = useMemo(
    () => [...payees.map(p => ({ id: p.id, value: p.name })), ...extraPayees.map(p => ({ id: p.id, value: p.name }))],
    [payees, extraPayees],
  );

  function openKeypad() {
    setPreKeypadAmount(amountDisplay);
    setKeypadOpen(true);
  }

  function cancelKeypad() {
    setFromAmount(preKeypadAmount);
    setKeypadOpen(false);
  }

  const dropdownInputClass = cn(finDropdownInputClass, 'border-b-0');

  return (
    <FinModalShell
      onClose={onCloseAction}
      title={isEdit ? 'Edit Transaction' : 'New Transaction'}
      scrollable={false}
      className="md:max-w-[480px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEdit ? 'Update Transaction' : `Save ${txType.charAt(0).toUpperCase() + txType.slice(1)}`}
      submitDisabled={isSubmitDisabled}
      submitLoading={isSubmitting}
    >
      {/* ====== MOBILE CONTENT ====== */}
      <div data-layout="mobile" className="flex flex-1 flex-col md:hidden">
        {/* Type toggle */}
        {!lockedType && (
          <div className="flex shrink-0 gap-1.5 px-4 pb-1 pt-3">
            {([TransactionTypes.Expense, TransactionTypes.Income, TransactionTypes.Transfer] as const).map(t => (
              <Button
                key={t}
                type="button"
                variant="transparent"
                size="xs"
                onClick={() => setValue('txType', t)}
                className={cn(
                  'flex-1 cursor-pointer rounded-[8px] py-2 text-xs font-medium',
                  txType === t ? 'font-semibold' : 'text-[var(--fin-muted)]',
                )}
                style={{
                  background: txType === t ? TYPE_COLORS[t] + '22' : 'var(--fin-card2)',
                  color: txType === t ? TYPE_COLORS[t] : undefined,
                  outline: txType === t ? `1px solid ${TYPE_COLORS[t]}44` : 'none',
                }}
              >
                {MOBILE_TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        )}

        {/* Amount display */}
        <div onClick={openKeypad} className="flex shrink-0 cursor-pointer flex-col items-center py-5 active:opacity-70">
          {largeExpression ? (
            <p className="px-5 text-center text-2xl font-bold leading-snug" style={{ color: typeColor }}>
              {largeExpression}
            </p>
          ) : (
            <span className="text-5xl font-bold tracking-tight" style={{ color: typeColor }}>
              {mobileAmountText}
            </span>
          )}
          {!amountDisplay && !largeExpression && !keypadOpen ? (
            <span className="mt-1.5 text-xs text-[var(--fin-muted)]">Tap to Enter Amount</span>
          ) : null}
        </div>

        {/* Fields — scrollable */}
        <div
          className="flex-1 divide-y divide-[var(--fin-border)] overflow-y-auto border-t border-[var(--fin-border)]"
          onClickCapture={() => {
            pressKey('=');
            setKeypadOpen(false);
          }}
        >
          {payeeRequired && (
            <>
              <MobileFieldRow label="Payee">
                <FinancialDropdown
                  options={payeeOptions}
                  value={selPayeeId ?? undefined}
                  onChange={item => {
                    const full = payees.find(p => p.id === item?.id);
                    if (full) selectPayee(full);
                  }}
                  fuse
                  placeholder="Select or add payee..."
                  createOption={payeeCreateOption}
                  inputClassName={dropdownInputClass}
                />
              </MobileFieldRow>
              {mostUsedPayees.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 py-2.5">
                  {mostUsedPayees.map(p => (
                    <Pill key={p.id} onClick={() => selectPayee(p)} label={p.name} color="var(--fin-accent)" />
                  ))}
                </div>
              )}
            </>
          )}

          {txType === TransactionTypes.Transfer ? (
            <>
              <MobileFieldRow label="To Account">
                {prefilledToAccountId != null ? (
                  <span className="text-[13px] font-medium text-[var(--fin-text)]">{prefilledToAccountName}</span>
                ) : (
                  <FinancialDropdown
                    searchable={false}
                    options={toAccountOptions}
                    value={selToAccId ?? undefined}
                    onChange={item => setSelToAccId(item ? (item.id as number) : null)}
                    renderOption={item => renderAccountOption(item, formData?.accounts ?? [])}
                    placeholder="Choose..."
                    inputClassName={dropdownInputClass}
                  />
                )}
              </MobileFieldRow>
              <MobileFieldRow label="Category">
                <FinancialDropdown
                  searchable={false}
                  options={categoryOptions}
                  value={selCatId ?? undefined}
                  onChange={item => setSelCatId(item ? (item.id as number) : null)}
                  clearable
                  noResultsText="No categories yet — add one in the Categories tab."
                  placeholder="⬡ Choose..."
                  inputClassName={dropdownInputClass}
                />
              </MobileFieldRow>
            </>
          ) : (
            <MobileFieldRow label="Category">
              <FinancialDropdown
                searchable={false}
                options={categoryOptions}
                value={selCatId ?? undefined}
                onChange={item => setSelCatId(item ? (item.id as number) : null)}
                clearable={txType !== TransactionTypes.Expense}
                noResultsText="No categories yet — add one in the Categories tab."
                placeholder={
                  selPayeeId == null && txType === TransactionTypes.Expense ? 'Select payee first' : '⬡ Choose...'
                }
                inputClassName={dropdownInputClass}
              />
            </MobileFieldRow>
          )}

          <MobileFieldRow label="Account">
            <FinancialDropdown
              searchable={false}
              options={accountOptions}
              value={selAccId ?? undefined}
              onChange={item => setSelAccId(item ? (item.id as number) : null)}
              renderOption={item => renderAccountOption(item, formData?.accounts ?? [])}
              placeholder="Choose..."
              inputClassName={dropdownInputClass}
            />
          </MobileFieldRow>

          <MobileFieldRow label="Date">
            <Input
              name="date"
              value={watch('date')}
              onChange={e => setValue('date', e.target.value)}
              type="date"
              variant="ghost"
              className="flex-1 text-[13px] text-[var(--fin-text)]"
            />
          </MobileFieldRow>

          <MobileFieldRow label="Memo">
            <Input
              {...register('note')}
              placeholder="Add a note..."
              variant="ghost"
              className="flex-1 text-[13px] text-[var(--fin-text)]"
            />
          </MobileFieldRow>

          <MobileFieldRow label="Labels">
            <LabelMultiSelect
              allLabels={allLabels}
              value={watch('labels')}
              onChange={vals => {
                const newOnes = vals.filter(v => !allLabels.includes(v));
                if (newOnes.length > 0) setAllLabels(prev => [...new Set([...prev, ...newOnes])].sort());
                setValue('labels', vals);
              }}
              inputClassName={dropdownInputClass}
            />
          </MobileFieldRow>
        </div>
      </div>

      {/* ====== DESKTOP FORM ====== */}
      <form
        data-layout="desktop"
        onSubmit={handleSubmit(onSubmit)}
        autoComplete="off"
        className="hidden flex-col gap-2.5 md:flex"
      >
        {!lockedType && (
          <div className="flex rounded-[9px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-[3px]">
            {([TransactionTypes.Expense, TransactionTypes.Income, TransactionTypes.Transfer] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('txType', t)}
                className={cn(
                  'flex-1 cursor-pointer rounded-[7px] border-none py-[7px] text-xs capitalize',
                  txType === t ? 'font-semibold' : 'bg-transparent text-[var(--fin-muted)]',
                )}
                style={{
                  background: txType === t ? TYPE_COLORS[t] + '22' : undefined,
                  color: txType === t ? TYPE_COLORS[t] : undefined,
                  outline: txType === t ? `1px solid ${TYPE_COLORS[t]}44` : 'none',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-4 py-3">
          {formData && (
            <span className="text-xl font-light text-[var(--fin-muted)]">
              {getCurrencySymbol(formData.currency ?? '')}
            </span>
          )}
          <Input
            value={amountDisplay}
            onKeyDown={amountKeyDown}
            onPaste={amountPaste}
            onChange={() => {}} // controlled by onKeyDown; e2e: use keyboard.type, not .fill
            autoFocus={!isEdit}
            type="text"
            inputMode="numeric"
            placeholder="0.00"
            variant="ghost"
            className="flex-1 text-[28px] font-bold"
            style={{ color: typeColor }}
          />
        </div>

        {!formData ? (
          <div className="flex flex-col gap-2.5">
            {[52, 80, 60, 60].map((h, i) => (
              <div
                key={i}
                className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)]"
                style={{ height: h, opacity: 0.6 }}
              />
            ))}
          </div>
        ) : (
          <>
            {payeeRequired && (
              <>
                <FinancialDropdown
                  options={payeeOptions}
                  value={selPayeeId ?? undefined}
                  onChange={item => {
                    const full = payees.find(p => p.id === item?.id);
                    if (full) selectPayee(full);
                  }}
                  fuse
                  placeholder="e.g. Kaufland, Netflix…"
                  createOption={payeeCreateOption}
                />
                {mostUsedPayees.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {mostUsedPayees.map(p => (
                      <Pill key={p.id} onClick={() => selectPayee(p)} label={p.name} color="var(--fin-accent)" />
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard className="cursor-default" label="Account">
                <FinancialDropdown
                  searchable={false}
                  options={accountOptions}
                  value={selAccId ?? undefined}
                  onChange={item => setSelAccId(item ? (item.id as number) : null)}
                  renderOption={item => renderAccountOption(item, formData.accounts)}
                  placeholder="Choose…"
                  inputClassName={dropdownInputClass}
                />
              </FinFieldCard>

              {txType === TransactionTypes.Transfer ? (
                <FinFieldCard className="cursor-default" label="To Account">
                  {prefilledToAccountId != null ? (
                    <div className="py-0.5 text-[13px] font-medium text-[var(--fin-text)]">
                      {prefilledToAccountName}
                    </div>
                  ) : (
                    <FinancialDropdown
                      searchable={false}
                      options={toAccountOptions}
                      value={selToAccId ?? undefined}
                      onChange={item => setSelToAccId(item ? (item.id as number) : null)}
                      renderOption={item => renderAccountOption(item, formData.accounts)}
                      placeholder="Choose…"
                      inputClassName={dropdownInputClass}
                    />
                  )}
                </FinFieldCard>
              ) : (
                <FinFieldCard className="cursor-default" label="Category">
                  <FinancialDropdown
                    searchable={false}
                    options={categoryOptions}
                    value={selCatId ?? undefined}
                    onChange={item => setSelCatId(item ? (item.id as number) : null)}
                    clearable={txType !== TransactionTypes.Expense}
                    noResultsText="No categories yet — add one in the Categories tab."
                    placeholder="⬡ Choose…"
                    inputClassName={dropdownInputClass}
                  />
                </FinFieldCard>
              )}
            </div>

            {txType === TransactionTypes.Transfer && (
              <FinFieldCard className="cursor-default" label="Category">
                <FinancialDropdown
                  searchable={false}
                  options={categoryOptions}
                  value={selCatId ?? undefined}
                  onChange={item => setSelCatId(item ? (item.id as number) : null)}
                  clearable
                  noResultsText="No categories yet — add one in the Categories tab."
                  placeholder="⬡ Choose…"
                  inputClassName={dropdownInputClass}
                />
              </FinFieldCard>
            )}

            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard className="cursor-default" label="Date">
                <Input
                  {...register('date')}
                  value={watch('date')}
                  type="date"
                  variant="ghost"
                  className="w-full text-[13px] text-[var(--fin-text)]"
                />
              </FinFieldCard>
              <FinFieldCard className="cursor-default" label="Notes">
                <Input
                  {...register('note')}
                  placeholder="Optional…"
                  variant="ghost"
                  className="w-full text-[13px] text-[var(--fin-text)]"
                />
              </FinFieldCard>
            </div>

            <FinFieldCard className="cursor-default" label="Labels">
              <LabelMultiSelect
                allLabels={allLabels}
                value={watch('labels')}
                onChange={vals => {
                  const newOnes = vals.filter(v => !allLabels.includes(v));
                  if (newOnes.length > 0) setAllLabels(prev => [...new Set([...prev, ...newOnes])].sort());
                  setValue('labels', vals);
                }}
              />
            </FinFieldCard>
          </>
        )}
      </form>

      {/* Keypad overlay — portalled bottom sheet on mobile */}
      {keypadOpen &&
        createPortal(
          <div className="finances-theme fixed inset-x-0 top-0 z-[1100] flex h-[100dvh] flex-col justify-end md:hidden pointer-events-none">
            <div className="fin-slide-up rounded-t-[18px] border border-[var(--fin-border)] bg-[var(--fin-card)] pointer-events-auto">
              <MobileAmountKeypad
                onKey={pressKey}
                onDone={() => {
                  pressKey('=');
                  setKeypadOpen(false);
                }}
                onCancel={cancelKeypad}
                expressionText={expressionText}
                expressionResult={expressionResult}
                currencySymbol={currencySymbol}
              />
            </div>
          </div>,
          document.body,
        )}
    </FinModalShell>
  );
}
