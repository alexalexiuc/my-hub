'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { Pill } from '../ui';
import { categoryIconEmoji } from '../categoryIcons';

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

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
              onClick={() => {
                onSelect(c.id);
                setOpen(false);
              }}
              className="block w-full px-3 py-[9px] text-left text-[13px]"
              style={{
                background: c.id === selectedId ? 'var(--fin-accent-d)' : 'transparent',
                border: 'none',
                color: c.id === selectedId ? 'var(--fin-accent)' : 'var(--fin-text)',
                cursor: 'pointer',
              }}
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
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
              className="block w-full px-3 py-[9px] text-left text-[13px]"
              style={{
                background: a.id === selectedId ? 'var(--fin-accent-d)' : 'transparent',
                border: 'none',
                color: a.id === selectedId ? 'var(--fin-accent)' : 'var(--fin-text)',
                cursor: 'pointer',
              }}
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
  const [txType, setTxType] = useState<TxType>('expense');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [selAccId, setSelAccId] = useState<number | null>(null);
  const [selToAccId, setSelToAccId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [autofillDismissed, setAutofillDismissed] = useState(false);

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

  async function handleSubmit() {
    if (!amount || !selAccId) return;
    if (needsCategory && !selCatId) return;
    setSaving(true);
    try {
      await apiFetch('/api/finances/transactions', {
        method: 'POST',
        body: {
          type: txType,
          accountId: selAccId,
          toAccountId: txType === 'transfer' ? selToAccId : undefined,
          amount: parseFloat(amount),
          date,
          categoryId: txType === 'transfer' ? null : selCatId,
          payeeName: payee.trim() || undefined,
          notes: note.trim() || undefined,
        },
        silentToast: true,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{
        background: 'var(--fin-overlay)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[480px] flex-col gap-2.5 overflow-y-auto rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="text-base font-bold text-[var(--fin-text)]">New Transaction</div>

        {!formData ? (
          <div className="flex flex-col gap-2.5">
            {[44, 52, 80, 60, 60].map((h, i) => (
              <div
                key={i}
                className="rounded-[10px] border"
                style={{
                  height: h,
                  background: 'var(--fin-card2)',
                  borderColor: 'var(--fin-border)',
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Type toggle */}
            <div className="flex rounded-[9px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-[3px]">
              {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTxType(t)}
                  className="flex-1 rounded-[7px] border-none py-[7px] text-xs capitalize"
                  style={{
                    background: txType === t ? TYPE_COLORS[t] + '22' : 'transparent',
                    color: txType === t ? TYPE_COLORS[t] : 'var(--fin-muted)',
                    fontWeight: txType === t ? 600 : 400,
                    cursor: 'pointer',
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
              <input
                autoFocus
                placeholder="e.g. Kaufland, Netflix…"
                value={payee}
                onChange={e => setPayee(e.target.value)}
                className="w-full border-none bg-transparent text-[15px] text-[var(--fin-text)] outline-none"
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
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 border-none bg-transparent text-[28px] font-bold outline-none"
                style={{
                  color: typeColor,
                }}
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
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border-none bg-transparent text-[13px] text-[var(--fin-text)] outline-none"
                />
              </FieldCard>
              <FieldCard label="Notes">
                <input
                  placeholder="Optional…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full border-none bg-transparent text-[13px] text-[var(--fin-text)] outline-none"
                />
              </FieldCard>
            </div>

            {/* Category quick-pick */}
            {txType !== 'transfer' && (
              <div className="flex flex-wrap gap-[5px]">
                {formData.categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelCatId(cat.id === selCatId ? null : cat.id)}
                    className="flex items-center gap-1 rounded-[20px] px-2.5 py-[5px] text-[11px]"
                    style={{
                      background: selCatId === cat.id ? (cat.color ?? 'var(--fin-accent)') + '28' : 'var(--fin-card2)',
                      border:
                        selCatId === cat.id
                          ? `1px solid ${(cat.color ?? 'var(--fin-accent)') + '66'}`
                          : '1px solid var(--fin-border)',
                      color: selCatId === cat.id ? (cat.color ?? 'var(--fin-accent)') : 'var(--fin-muted)',
                      cursor: 'pointer',
                      fontWeight: selCatId === cat.id ? 600 : 400,
                    }}
                  >
                    <span>{categoryIconEmoji(cat.icon)}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-0.5 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] py-2.5 text-[13px] font-semibold text-[var(--fin-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!amount || !selAccId || (needsCategory && !selCatId) || saving}
                className="flex-[2] rounded-lg border-none py-2.5 text-[13px] font-bold"
                style={{
                  background:
                    !amount || !selAccId || (needsCategory && !selCatId) || saving ? 'var(--fin-card3)' : typeColor,
                  color:
                    !amount || !selAccId || (needsCategory && !selCatId) || saving
                      ? 'var(--fin-subtle)'
                      : 'var(--fin-on-solid)',
                  cursor: !amount || !selAccId || (needsCategory && !selCatId) || saving ? 'not-allowed' : 'pointer',
                  transition: 'background .15s',
                }}
              >
                {saving ? 'Saving…' : `Save ${txType.charAt(0).toUpperCase() + txType.slice(1)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
