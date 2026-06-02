'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn, apiFetch } from '@/lib/utils';
import { FinModalShell } from '../../FinModalShell';
import { useAmountMask } from '../useAmountMask';
import { MobileAmountKeypad } from '../MobileAmountKeypad';
import { TransactionModalMobile } from './TransactionModalMobile';
import { TransactionModalDesktop } from './TransactionModalDesktop';
import type { PayeesResponse, PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import type { TransactionDetail, TransactionMutationResponse } from '@/app/api/finances/transactions/[id]/route';
import type { LabelsResponse } from '@/app/api/finances/labels/route';
import { getCurrencySymbol, isPayeeRequired, localDateString } from '@my-hub/shared/utils';
import { EXPENSE_ACCOUNT_TYPES, TransactionType, TransactionTypes } from '@my-hub/shared/constants';
import {
  AddTransactionSchema,
  defaultAddTransactionValues,
  type AddTransactionValues,
} from '../../finances-form.schema';
import { sortAccountsByGroup } from '../../accounts/accounts.utils';
import { categoryIconEmoji } from '../../categoryIcons';
import { finDropdownInputClass, TRANSACTION_TYPE_COLORS } from '../../finances.utils';
import { formatMobileAmount, formatDigitsWithCurrency, formatDigitsCompact } from './transactionModal.utils';

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
    const [fd, pd, labelsData, selectedTransaction] = await Promise.all([
      apiFetch<TransactionFormDataResponse>('/api/finances/transactions/form-data', { silentToast: true }),
      apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true }),
      apiFetch<LabelsResponse>('/api/finances/labels', { silentToast: true }),
      isEdit
        ? apiFetch<TransactionDetail>(`/api/finances/transactions/${editId}`, { silentToast: true })
        : Promise.resolve(null),
    ]);

    setFormData(fd);
    if (pd) setPayees(pd.payees);
    if (labelsData) setAllLabels(labelsData.labels);

    if (selectedTransaction) {
      setValue('txType', selectedTransaction.type);
      setFromAmount(String(selectedTransaction.amount));
      setValue('date', selectedTransaction.date);
      setValue('payee', selectedTransaction.payeeName ?? '');
      setValue('note', selectedTransaction.notes ?? '');
      setValue('labels', selectedTransaction.labels ?? []);
      setSelPayeeId(selectedTransaction.payeeId ?? null);
      setSelAccId(selectedTransaction.accountId);
      if (selectedTransaction.toAccountId != null) setSelToAccId(selectedTransaction.toAccountId);
      if (selectedTransaction.categoryId != null) setSelCatId(selectedTransaction.categoryId);
    }
  }, [editId, isEdit, setValue, setFromAmount]);

  useEffect(() => {
    load();
  }, [load]);

  function selectPayee(p: PayeeWithSuggestion) {
    setValue('payee', p.name);
    setSelPayeeId(p.id);
    if (p.lastUsedCategoryId != null && formData) setSelCatId(p.lastUsedCategoryId);
    if (p.lastUsedAccountId != null && formData) {
      const acc = formData.accounts.find(a => a.id === p.lastUsedAccountId);
      if (acc) setSelAccId(acc.id);
    }
  }

  const typeColor = TRANSACTION_TYPE_COLORS[txType];

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

  const expressionTerms = useMemo(
    () => (tokens.length === 0 ? null : rawDigits ? [...tokens, rawDigits] : tokens),
    [tokens, rawDigits],
  );

  const largeExpression = useMemo(
    () =>
      expressionTerms?.map(t => (t === '+' || t === '-' ? t : formatDigitsWithCurrency(t, currencyCode))).join(' ') ??
      null,
    [expressionTerms, currencyCode],
  );

  const expressionText = useMemo(
    () => expressionTerms?.map(t => (t === '+' || t === '-' ? t : formatDigitsCompact(t))).join(' '),
    [expressionTerms],
  );

  const accountOptions = useMemo(
    () =>
      sortAccountsByGroup(
        (txType === TransactionTypes.Expense
          ? (formData?.accounts ?? []).filter(a => EXPENSE_ACCOUNT_TYPES.has(a.type as never))
          : (formData?.accounts ?? [])
        ).filter(a => !a.archived || a.id === selAccId),
      ).map(a => ({ id: a.id, value: a.name })),
    [txType, formData?.accounts, selAccId],
  );

  const categoryOptions = useMemo(
    () =>
      formData?.categories.map(c => ({
        id: c.id,
        value: `${categoryIconEmoji(c.icon)} ${c.name}`.trim(),
      })) ?? [],
    [formData?.categories],
  );

  const toAccountOptions = useMemo(
    () =>
      sortAccountsByGroup(
        (formData?.accounts ?? []).filter(a => a.id !== selAccId).filter(a => !a.archived || a.id === selToAccId),
      ).map(a => ({ id: a.id, value: a.name })),
    [formData?.accounts, selAccId, selToAccId],
  );

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

  const handleLabelsChange = useCallback(
    (vals: string[]) => {
      const newOnes = vals.filter(v => !allLabels.includes(v));
      if (newOnes.length > 0) setAllLabels(prev => [...new Set([...prev, ...newOnes])].sort());
      setValue('labels', vals);
    },
    [allLabels, setValue],
  );

  const dropdownInputClass = cn(finDropdownInputClass, 'border-b-0');

  const formSubmitHandler = handleSubmit(onSubmit);

  const submitLabel = isEdit ? 'Update Transaction' : `Save ${txType.charAt(0).toUpperCase() + txType.slice(1)}`;

  const sharedDropdownProps = {
    payeeRequired,
    payeeOptions,
    payees,
    selPayeeId,
    selectPayee,
    payeeCreateOption,
    mostUsedPayees,
    accountOptions,
    selAccId,
    setSelAccId,
    toAccountOptions,
    selToAccId,
    setSelToAccId,
    categoryOptions,
    selCatId,
    setSelCatId,
    prefilledToAccountId,
    prefilledToAccountName,
    allLabels,
    onLabelsChange: handleLabelsChange,
    dropdownInputClass,
  } as const;

  return (
    <FinModalShell
      onClose={onCloseAction}
      title={isEdit ? 'Edit Transaction' : 'New Transaction'}
      scrollable={false}
      className="md:max-w-[480px]"
      onSubmit={formSubmitHandler}
      submitLabel={submitLabel}
      submitDisabled={isSubmitDisabled}
      submitLoading={isSubmitting}
    >
      <TransactionModalMobile
        {...sharedDropdownProps}
        txType={txType}
        setTxType={t => setValue('txType', t)}
        lockedType={lockedType}
        typeColor={typeColor}
        amountDisplay={amountDisplay}
        mobileAmountText={mobileAmountText}
        largeExpression={largeExpression}
        keypadOpen={keypadOpen}
        openKeypad={openKeypad}
        closeKeypadAndCommit={() => {
          pressKey('=');
          setKeypadOpen(false);
        }}
        allAccounts={formData?.accounts ?? []}
        date={watch('date')}
        setDate={d => setValue('date', d)}
        register={register}
        labels={watch('labels')}
      />

      <TransactionModalDesktop
        {...sharedDropdownProps}
        register={register}
        watch={watch}
        onFormSubmit={formSubmitHandler}
        isEdit={isEdit}
        txType={txType}
        setTxType={t => setValue('txType', t)}
        lockedType={lockedType}
        typeColor={typeColor}
        formData={formData}
        amountDisplay={amountDisplay}
        amountKeyDown={amountKeyDown}
        amountPaste={amountPaste}
      />

      {keypadOpen &&
        createPortal(
          <div className="finances-theme fixed inset-x-0 top-0 z-[1100] flex h-[100dvh] flex-col justify-end md:hidden pointer-events-none">
            <div className="slide-up-sheet rounded-t-[18px] border border-[var(--border)] bg-[var(--card)] pointer-events-auto">
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
