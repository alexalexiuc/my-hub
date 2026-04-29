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
import type { PayeesResponse, PayeeSuggestion, TransactionFormDataResponse } from '@/app/api/finances/contracts';
import { getCurrencySymbol } from '@my-hub/shared/utils';

type TxType = 'expense' | 'income' | 'transfer';

const TYPE_COLORS: Record<TxType, string> = {
  expense: 'var(--fin-red)',
  income: 'var(--fin-green)',
  transfer: 'var(--fin-blue)',
};

function FieldCard({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)] px-3 py-2.5 ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="mb-[3px] text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">{label}</div>
      {children}
    </div>
  );
}

type AddTransactionModalProps = {
  onClose: () => void;
  onCreated: () => void;
  /** Pre-loaded payee suggestions — pass from parent to avoid re-fetching each open. */
  // payees?: PayeeSuggestion[];
};

export function AddTransactionModal({ onClose, onCreated }: AddTransactionModalProps) {
  const [formData, setFormData] = useState<TransactionFormDataResponse | null>(null);
  const [payees, setPayees] = useState<PayeeSuggestion[]>([]);
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [selAccId, setSelAccId] = useState<number | null>(null);
  const [selToAccId, setSelToAccId] = useState<number | null>(null);
  const [accQuery, setAccQuery] = useState('');
  const [toAccQuery, setToAccQuery] = useState('');
  const [catQuery, setCatQuery] = useState('');

  const mostUsedPayees = useMemo(() => {
    const sorted = [...payees]
      .filter(p => p.useCount > 0)
      .sort(
        (a, b) =>
          b.useCount - a.useCount || new Date(b.lastUsedAt ?? '').getTime() - new Date(a.lastUsedAt ?? '').getTime(),
      );
    return sorted.slice(0, 5);
  }, [payees]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<AddTransactionValues>({
    resolver: zodResolver(AddTransactionSchema),
    defaultValues: defaultAddTransactionValues,
  });

  const txType = watch('txType');
  const payeeQuery = watch('payee');

  const load = useCallback(async () => {
    // TODO: Considering local storage to make modal faster, if will be necessary
    const [fd, pd] = await Promise.all([
      apiFetch<TransactionFormDataResponse>('/api/finances/transactions/form-data', { silentToast: true }),
      apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true }),
    ]);
    setFormData(fd);
    if (fd.accounts[0]) {
      setSelAccId(fd.accounts[0].id);
      setAccQuery(fd.accounts[0].name);
    }
    if (pd) setPayees(pd.payees);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function selectPayee(p: PayeeSuggestion) {
    setValue('payee', p.name);
    if (p.recentCategoryId != null) setSelCatId(p.recentCategoryId);
  }

  const typeColor = TYPE_COLORS[txType];

  async function onSubmit(values: AddTransactionValues) {
    if (!selAccId) return;
    await apiFetch('/api/finances/transactions', {
      method: 'POST',
      body: {
        type: values.txType,
        accountId: selAccId,
        toAccountId: txType === 'transfer' ? selToAccId : undefined,
        amount: parseFloat(values.amount),
        date: values.date,
        categoryId: txType === 'transfer' ? null : selCatId,
        payeeName: values.payee.trim() || undefined,
        notes: values.note.trim() || undefined,
      },
      silentToast: true,
    });
    onCreated();
  }

  const isSubmitDisabled = !watch('amount') || !selAccId || isSubmitting;

  return (
    <FinModalShell onClose={onClose} title="New Transaction" className="md:max-w-[480px]">
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
          {/* Type toggle */}
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

          {/* Amount */}
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-4 py-3">
            <span className="text-xl font-light text-[var(--fin-muted)]">{getCurrencySymbol(formData.currency)}</span>
            <Input
              {...register('amount')}
              autoFocus
              type="number"
              placeholder="0.00"
              variant="ghost"
              className="flex-1 text-[28px] font-bold"
              style={{ color: typeColor }}
            />
          </div>

          {/* Payee with fuzzy dropdown — hidden for transfers */}
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

          {/* Account + Category (or To Account for transfer) */}
          <div className="grid grid-cols-2 gap-2">
            <FieldCard label="Account">
              <FinancialDropdown
                options={formData.accounts.map(a => ({ id: a.id, value: a.name }))}
                query={accQuery}
                onQueryChange={setAccQuery}
                onSelect={item => {
                  setSelAccId(item.id as number);
                  setAccQuery(String(item.value));
                }}
                clearable
                onClear={() => {
                  setSelAccId(null);
                  setAccQuery('');
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
                <FinancialDropdown
                  options={formData.accounts.filter(a => a.id !== selAccId).map(a => ({ id: a.id, value: a.name }))}
                  query={toAccQuery}
                  onQueryChange={setToAccQuery}
                  onSelect={item => {
                    setSelToAccId(item.id as number);
                    setToAccQuery(String(item.value));
                  }}
                  clearable
                  onClear={() => {
                    setSelToAccId(null);
                    setToAccQuery('');
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
            ) : (
              <FieldCard label="Category">
                <FinancialDropdown
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
                  clearable
                  onClear={() => {
                    setSelCatId(null);
                    setCatQuery('');
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
            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose}>
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
              {`Save ${txType.charAt(0).toUpperCase() + txType.slice(1)}`}
            </Button>
          </div>
        </form>
      )}
    </FinModalShell>
  );
}
