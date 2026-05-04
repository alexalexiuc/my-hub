'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { FinancialDropdown } from '../FinancialDropdown';
import { FinModalShell } from '../FinModalShell';
import { Button, Input, Pill } from '@/components';
import { categoryIconEmoji } from '../categoryIcons';
import { AddTransactionSchema, defaultAddTransactionValues, type AddTransactionValues } from '../finances-form.schema';
import type {
  PayeesResponse,
  PayeeSuggestion,
  TransactionFormDataResponse,
  TransactionDetail,
  TransactionMutationResponse,
} from '@/app/api/finances/contracts';
import { getCurrencySymbol } from '@my-hub/shared/utils';

type TxType = 'expense' | 'income' | 'transfer';

const TYPE_COLORS: Record<TxType, string> = {
  expense: 'var(--fin-red)',
  income: 'var(--fin-green)',
  transfer: 'var(--fin-blue)',
};

function FieldCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cursor-default rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)] px-3 py-2.5">
      <div className="mb-[3px] text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">{label}</div>
      {children}
    </div>
  );
}

type TransactionModalProps = {
  onCloseAction: () => void;
  onSavedAction: (result?: TransactionMutationResponse) => void;
  /** When provided the modal opens in edit mode, pre-populated with that transaction's data. */
  editId?: number;
  initialType?: TxType;
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
  const [payees, setPayees] = useState<PayeeSuggestion[]>([]);
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [selAccId, setSelAccId] = useState<number | null>(null);
  const [selToAccId, setSelToAccId] = useState<number | null>(prefilledToAccountId ?? null);
  const [accQuery, setAccQuery] = useState('');
  const [toAccQuery, setToAccQuery] = useState('');
  const [catQuery, setCatQuery] = useState('');

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
    defaultValues: { ...defaultAddTransactionValues, txType: initialType ?? 'expense' },
  });

  const txType = watch('txType');
  const payeeQuery = watch('payee');

  const load = useCallback(async () => {
    const [fd, pd, detail] = await Promise.all([
      apiFetch<TransactionFormDataResponse>('/api/finances/transactions/form-data', { silentToast: true }),
      apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true }),
      isEdit
        ? apiFetch<TransactionDetail>(`/api/finances/transactions/${editId}`, { silentToast: true })
        : Promise.resolve(null),
    ]);

    setFormData(fd);
    if (pd) setPayees(pd.payees);

    if (detail) {
      setValue('txType', detail.type as TxType);
      setValue('amount', String(detail.amount));
      setValue('date', detail.date);
      setValue('payee', detail.payeeName ?? '');
      setValue('note', detail.notes ?? '');

      setSelAccId(detail.accountId);
      const acc = fd.accounts.find(a => a.id === detail.accountId);
      if (acc) setAccQuery(acc.name);

      if (detail.toAccountId != null) {
        setSelToAccId(detail.toAccountId);
        const toAcc = fd.accounts.find(a => a.id === detail.toAccountId);
        if (toAcc) setToAccQuery(toAcc.name);
      }

      if (detail.categoryId != null) {
        setSelCatId(detail.categoryId);
        const cat = fd.categories.find(c => c.id === detail.categoryId);
        if (cat) setCatQuery(`${categoryIconEmoji(cat.icon)} ${cat.name}`.trim());
      }
    }
  }, [editId, isEdit, setValue]);

  useEffect(() => {
    load();
  }, [load]);

  function selectPayee(p: PayeeSuggestion) {
    setValue('payee', p.name);
    if (p.recentCategoryId != null && formData) {
      setSelCatId(p.recentCategoryId);
      const cat = formData.categories.find(c => c.id === p.recentCategoryId);
      if (cat) setCatQuery(`${categoryIconEmoji(cat.icon)} ${cat.name}`.trim());
    }
    if (p.recentAccountId != null && formData) {
      const acc = formData.accounts.find(a => a.id === p.recentAccountId);
      if (acc) {
        setSelAccId(acc.id);
        setAccQuery(acc.name);
      }
    }
  }

  const typeColor = TYPE_COLORS[txType];

  async function onSubmit(values: AddTransactionValues) {
    if (!selAccId) return;
    const body = {
      type: values.txType,
      accountId: selAccId,
      // Always send toAccountId so edits that change type from transfer→expense clear it
      toAccountId: txType === 'transfer' ? selToAccId : null,
      amount: parseFloat(values.amount),
      date: values.date,
      categoryId: txType === 'transfer' ? null : selCatId,
      payeeName: values.payee.trim() || undefined,
      notes: values.note.trim() || undefined,
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

  const isSubmitDisabled = !watch('amount') || !selAccId || isSubmitting;

  return (
    <FinModalShell
      onClose={onCloseAction}
      title={isEdit ? 'Edit Transaction' : 'New Transaction'}
      className="md:max-w-[480px]"
    >
      {!formData ? (
        <div className="flex flex-col gap-2.5">
          {[44, 52, 80, 60, 60].map((h, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)]"
              style={{ height: h, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="flex flex-col gap-2.5">
          {/* Type toggle — hidden when type is locked */}
          {!lockedType && (
            <div className="flex rounded-[9px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-[3px]">
              {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
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

          {/* Amount */}
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-4 py-3">
            <span className="text-xl font-light text-[var(--fin-muted)]">{getCurrencySymbol(formData.currency)}</span>
            <Input
              {...register('amount')}
              autoFocus={!isEdit}
              type="number"
              placeholder="0.00"
              variant="ghost"
              className="flex-1 text-[28px] font-bold"
              style={{ color: typeColor }}
            />
          </div>

          {/* Payee — hidden for transfers */}
          {txType !== 'transfer' && (
            <>
              <FinancialDropdown
                options={payees.map(p => ({ id: p.id, value: p.name }))}
                query={payeeQuery}
                onQueryChange={v => setValue('payee', v)}
                onSelect={item => {
                  const full = payees.find(p => p.id === item.id);
                  if (full) selectPayee(full);
                }}
                fuse
                placeholder="e.g. Kaufland, Netflix…"
                createOption={{ onCreate: name => setValue('payee', name) }}
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

          {/* Account + Category / To Account */}
          <div className="grid grid-cols-2 gap-2">
            <FieldCard label="Account">
              <FinancialDropdown
                searchable={false}
                options={formData.accounts.map(a => ({ id: a.id, value: a.name }))}
                query={accQuery}
                onQueryChange={setAccQuery}
                onSelect={item => {
                  setSelAccId(item.id as number);
                  setAccQuery(String(item.value));
                }}
                renderOption={item => {
                  const acc = formData.accounts.find(a => a.id === item.id);
                  return (
                    <span className="flex w-full items-center justify-between">
                      <span>{String(item.value)}</span>
                      {acc && <span className="ml-auto text-[10px] text-[var(--fin-subtle)]">{acc.currency}</span>}
                    </span>
                  );
                }}
                placeholder="Choose…"
                inputClassName="border-b-0 py-0 text-[13px] font-medium text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]"
              />
            </FieldCard>

            {txType === 'transfer' ? (
              <FieldCard label="To Account">
                {prefilledToAccountId != null ? (
                  <div className="py-0.5 text-[13px] font-medium text-[var(--fin-text)]">{prefilledToAccountName}</div>
                ) : (
                  <FinancialDropdown
                    searchable={false}
                    options={formData.accounts.filter(a => a.id !== selAccId).map(a => ({ id: a.id, value: a.name }))}
                    query={toAccQuery}
                    onQueryChange={setToAccQuery}
                    onSelect={item => {
                      setSelToAccId(item.id as number);
                      setToAccQuery(String(item.value));
                    }}
                    renderOption={item => {
                      const acc = formData.accounts.find(a => a.id === item.id);
                      return (
                        <span className="flex w-full items-center justify-between">
                          <span>{String(item.value)}</span>
                          {acc && <span className="ml-auto text-[10px] text-[var(--fin-subtle)]">{acc.currency}</span>}
                        </span>
                      );
                    }}
                    placeholder="Choose…"
                    inputClassName="border-b-0 py-0 text-[13px] font-medium text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]"
                  />
                )}
              </FieldCard>
            ) : (
              <FieldCard label="Category">
                <FinancialDropdown
                  searchable={false}
                  options={formData.categories.map(c => ({
                    id: c.id,
                    value: `${categoryIconEmoji(c.icon)} ${c.name}`.trim(),
                  }))}
                  query={catQuery}
                  onQueryChange={setCatQuery}
                  onSelect={item => {
                    setSelCatId(item.id as number);
                    setCatQuery(String(item.value));
                  }}
                  noResultsText="No categories yet — add one in the Categories tab."
                  placeholder="⬡ Choose…"
                  inputClassName="border-b-0 py-0 text-[13px] font-medium text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]"
                />
              </FieldCard>
            )}
          </div>

          {/* Date + Notes */}
          <div className="grid grid-cols-2 gap-2">
            <FieldCard label="Date">
              <Input
                {...register('date')}
                type="date"
                variant="ghost"
                className="w-full text-[13px] text-[var(--fin-text)]"
              />
            </FieldCard>
            <FieldCard label="Notes">
              <Input
                {...register('note')}
                placeholder="Optional…"
                variant="ghost"
                className="w-full text-[13px] text-[var(--fin-text)]"
              />
            </FieldCard>
          </div>

          {/* Actions */}
          <div className="mt-0.5 flex gap-2">
            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onCloseAction}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="flex-[2]"
              disabled={isSubmitDisabled}
              loading={isSubmitting}
              style={{
                background: isSubmitDisabled ? 'var(--fin-card3)' : typeColor,
                color: isSubmitDisabled ? 'var(--fin-subtle)' : 'var(--fin-on-solid)',
              }}
            >
              {isEdit ? 'Update Transaction' : `Save ${txType.charAt(0).toUpperCase() + txType.slice(1)}`}
            </Button>
          </div>
        </form>
      )}
    </FinModalShell>
  );
}
