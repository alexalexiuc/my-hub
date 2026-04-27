'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button, Input } from '@/components';
import { Pill } from '../ui';
import { categoryIconEmoji } from '../categoryIcons';
import { AddTransactionSchema, defaultAddTransactionValues, type AddTransactionValues } from '../finances-form.schema';

interface AccountOption {
  id: number;
  name: string;
  type: string;
  currency: string;
}
interface CategoryOption {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
}
interface FormData {
  currency: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  payeeSuggestions: Record<string, { categoryId: number | null; accountId: number }>;
}

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

function CategoryDropdown({
  categories,
  selectedId,
  onSelect,
}: {
  categories: CategoryOption[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = categories.find(c => c.id === selectedId);

  return (
    <div className="relative">
      <FieldCard label="Category *" onClick={() => setOpen(o => !o)}>
        <div className={`text-[13px] font-medium ${selected ? 'text-[var(--fin-text)]' : 'text-[var(--fin-red)]'}`}>
          {selected ? `${selected.icon ? categoryIconEmoji(selected.icon) + ' ' : ''}${selected.name}` : '⬡ Required…'}
        </div>
      </FieldCard>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[220px] overflow-hidden overflow-y-auto rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)]">
          {categories.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-[var(--fin-subtle)]">
              No categories yet — add one in the Categories tab.
            </div>
          )}
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id);
                setOpen(false);
              }}
              className={cn(
                'block w-full cursor-pointer border-none px-3 py-[9px] text-left text-[13px]',
                c.id === selectedId
                  ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)]'
                  : 'bg-transparent text-[var(--fin-text)]',
              )}
            >
              <span className="mr-1.5">{categoryIconEmoji(c.icon)}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountDropdown({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: AccountOption[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find(a => a.id === selectedId);

  return (
    <div className="relative">
      <FieldCard label="Account" onClick={() => setOpen(o => !o)}>
        <div className={`text-[13px] font-medium ${selected ? 'text-[var(--fin-text)]' : 'text-[var(--fin-subtle)]'}`}>
          🏦 {selected?.name ?? 'Choose…'}
        </div>
      </FieldCard>
      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)]">
          {accounts.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
              className={cn(
                'block w-full cursor-pointer border-none px-3 py-[9px] text-left text-[13px]',
                a.id === selectedId
                  ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)]'
                  : 'bg-transparent text-[var(--fin-text)]',
              )}
            >
              {a.name}
              <span className="ml-1.5 text-[10px] text-[var(--fin-subtle)]">{a.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type AddTransactionModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

export function AddTransactionModal({ onClose, onCreated }: AddTransactionModalProps) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [selAccId, setSelAccId] = useState<number | null>(null);
  const [selToAccId, setSelToAccId] = useState<number | null>(null);
  const [autofillDismissed, setAutofillDismissed] = useState(false);

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
  const payee = watch('payee');

  const load = useCallback(async () => {
    const data = await apiFetch<FormData>('/api/finances/transactions/form-data', { silentToast: true });
    setFormData(data);
    if (data.accounts[0]) setSelAccId(data.accounts[0].id);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const suggestion = formData?.payeeSuggestions[payee.trim().toLowerCase()];
  const hasSuggestion = !!suggestion && payee.trim().length > 2 && !autofillDismissed;

  useEffect(() => {
    setAutofillDismissed(false);
  }, [payee]);

  useEffect(() => {
    if (hasSuggestion && suggestion) {
      if (suggestion.categoryId != null) setSelCatId(suggestion.categoryId);
      setSelAccId(suggestion.accountId);
    }
  }, [hasSuggestion, suggestion]);

  const selectedCat = formData?.categories.find(c => c.id === selCatId);
  const typeColor = TYPE_COLORS[txType];
  const needsCategory = txType !== 'transfer';

  async function onSubmit(values: AddTransactionValues) {
    if (!selAccId) return;
    if (needsCategory && !selCatId) return;
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

  const isSubmitDisabled = !watch('amount') || !selAccId || (needsCategory && !selCatId) || isSubmitting;

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
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2.5">
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

          {/* Payee */}
          <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-[14px] py-[10px]">
            <div className="mb-1 text-[10px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">Payee</div>
            <Input
              {...register('payee')}
              autoFocus
              placeholder="e.g. Kaufland, Netflix…"
              variant="ghost"
              className="w-full text-[15px]"
            />
          </div>

          {/* Autofill hint */}
          {hasSuggestion && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2 text-xs">
              <span className="text-[var(--fin-subtle)]">↩</span>
              <span className="text-[var(--fin-muted)]">Filled from past entries:</span>
              {selectedCat && (
                <Pill
                  icon={categoryIconEmoji(selectedCat.icon)}
                  label={selectedCat.name}
                  color={selectedCat.color ?? 'var(--fin-accent)'}
                />
              )}
              <span className="text-[var(--fin-subtle)]">·</span>
              <span className="text-[11px] text-[var(--fin-muted)]">
                {formData.accounts.find(a => a.id === selAccId)?.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelCatId(null);
                  setAutofillDismissed(true);
                }}
                className="ml-auto border-none bg-transparent text-xs text-[var(--fin-subtle)]"
              >
                ✕
              </button>
            </div>
          )}

          {/* Amount */}
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-4 py-3">
            <span className="text-xl font-light text-[var(--fin-muted)]">
              {(() => {
                const acctCurrency = formData.accounts.find(a => a.id === selAccId)?.currency ?? formData.currency;
                return acctCurrency === 'USD'
                  ? '$'
                  : acctCurrency === 'GBP'
                    ? '£'
                    : acctCurrency === 'EUR'
                      ? '€'
                      : acctCurrency;
              })()}
            </span>
            <Input
              {...register('amount')}
              type="number"
              placeholder="0.00"
              variant="ghost"
              className="flex-1 text-[28px] font-bold"
              style={{ color: typeColor }}
            />
          </div>

          {/* Account + Category (or To Account for transfer) */}
          <div className="grid grid-cols-2 gap-2">
            <AccountDropdown accounts={formData.accounts} selectedId={selAccId} onSelect={setSelAccId} />
            {txType === 'transfer' ? (
              <AccountDropdown
                accounts={formData.accounts.filter(a => a.id !== selAccId)}
                selectedId={selToAccId}
                onSelect={setSelToAccId}
              />
            ) : (
              <CategoryDropdown categories={formData.categories} selectedId={selCatId} onSelect={setSelCatId} />
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

          {/* Category quick-pick */}
          {txType !== 'transfer' && (
            <div className="flex flex-wrap gap-[5px]">
              {formData.categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelCatId(cat.id === selCatId ? null : cat.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-[20px] px-2.5 py-[5px] text-[11px]',
                    selCatId === cat.id ? 'font-semibold' : 'bg-[var(--fin-card2)] text-[var(--fin-muted)]',
                  )}
                  style={
                    selCatId === cat.id
                      ? {
                          background: (cat.color ?? 'var(--fin-accent)') + '28',
                          border: `1px solid ${(cat.color ?? 'var(--fin-accent)') + '66'}`,
                          color: cat.color ?? 'var(--fin-accent)',
                        }
                      : { border: '1px solid var(--fin-border)' }
                  }
                >
                  <span>{categoryIconEmoji(cat.icon)}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          )}

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
