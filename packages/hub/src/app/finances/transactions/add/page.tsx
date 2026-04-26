'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, Pill } from '../../ui';
import { categoryIconEmoji } from '../../categoryIcons';

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
  expense: T.red,
  income: T.green,
  transfer: T.blue,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function FieldCard({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{ fontSize: 9, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}
      >
        {label}
      </div>
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
    <div style={{ position: 'relative' }}>
      <FieldCard label="Category *" onClick={() => setOpen(o => !o)}>
        <div
          style={{
            fontSize: 13,
            color: selected ? T.text : T.red,
            fontWeight: 500,
          }}
        >
          {selected ? `${selected.icon ? categoryIconEmoji(selected.icon) + ' ' : ''}${selected.name}` : '⬡ Required…'}
        </div>
      </FieldCard>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: 4,
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            overflow: 'hidden',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {categories.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: T.subtle }}>
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
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                background: c.id === selectedId ? T.accentD : 'transparent',
                border: 'none',
                color: c.id === selectedId ? T.accent : T.text,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span style={{ marginRight: 6 }}>{categoryIconEmoji(c.icon)}</span>
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
    <div style={{ position: 'relative' }}>
      <FieldCard label="Account" onClick={() => setOpen(o => !o)}>
        <div style={{ fontSize: 13, color: selected ? T.text : T.subtle, fontWeight: 500 }}>
          🏦 {selected?.name ?? 'Choose…'}
        </div>
      </FieldCard>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            marginTop: 4,
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                background: a.id === selectedId ? T.accentD : 'transparent',
                border: 'none',
                color: a.id === selectedId ? T.accent : T.text,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {a.name}
              <span style={{ fontSize: 10, color: T.subtle, marginLeft: 6 }}>{a.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddTransactionPage() {
  const router = useRouter();
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

  // Autofill from payee history
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
      router.push('/finances/transactions');
    } finally {
      setSaving(false);
    }
  }

  if (!formData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[44, 52, 80, 60, 60].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: `1px solid ${T.border}`,
            color: T.muted,
            padding: '5px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ✕
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>New Transaction</div>
      </div>

      {/* Type toggle */}
      <div
        style={{ display: 'flex', background: T.card2, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}
      >
        {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
          <button
            key={t}
            onClick={() => setTxType(t)}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: 7,
              border: 'none',
              background: txType === t ? TYPE_COLORS[t] + '22' : 'transparent',
              color: txType === t ? TYPE_COLORS[t] : T.muted,
              fontSize: 12,
              fontWeight: txType === t ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
              outline: txType === t ? `1px solid ${TYPE_COLORS[t]}44` : 'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Payee */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px' }}>
        <div
          style={{ fontSize: 10, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}
        >
          Payee
        </div>
        <input
          autoFocus
          placeholder="e.g. Carrefour, Netflix…"
          value={payee}
          onChange={e => setPayee(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: T.text,
            fontSize: 15,
          }}
        />
      </div>

      {/* Autofill hint */}
      {hasSuggestion && (
        <div
          style={{
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          <span style={{ color: T.subtle }}>↩</span>
          <span style={{ color: T.muted }}>Filled from past entries:</span>
          {selectedCat && (
            <Pill
              icon={categoryIconEmoji(selectedCat.icon)}
              label={selectedCat.name}
              color={selectedCat.color ?? T.accent}
            />
          )}
          <span style={{ color: T.subtle }}>·</span>
          <span style={{ color: T.muted, fontSize: 11 }}>{formData.accounts.find(a => a.id === selAccId)?.name}</span>
          <button
            onClick={() => {
              setSelCatId(null);
              setAutofillDismissed(true);
            }}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: T.subtle,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Amount */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 20, color: T.muted, fontWeight: 300 }}>
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
          style={{
            flex: 1,
            fontSize: 28,
            fontWeight: 700,
            color: typeColor,
            background: 'transparent',
            border: 'none',
            outline: 'none',
          }}
        />
      </div>

      {/* Account + Category (or To Account for transfer) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <FieldCard label="Date">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.text,
              fontSize: 13,
              width: '100%',
            }}
          />
        </FieldCard>
        <FieldCard label="Notes">
          <input
            placeholder="Optional…"
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.text,
              fontSize: 13,
            }}
          />
        </FieldCard>
      </div>

      {/* Category quick-pick (expense/income only) */}
      {txType !== 'transfer' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {formData.categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelCatId(cat.id === selCatId ? null : cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 20,
                background: selCatId === cat.id ? (cat.color ?? T.accent) + '28' : T.card2,
                border: selCatId === cat.id ? `1px solid ${cat.color ?? T.accent}66` : `1px solid ${T.border}`,
                color: selCatId === cat.id ? (cat.color ?? T.accent) : T.muted,
                fontSize: 11,
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

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!amount || !selAccId || (needsCategory && !selCatId) || saving}
        style={{
          background: !amount || !selAccId || (needsCategory && !selCatId) || saving ? T.card3 : typeColor,
          color: !amount || !selAccId || (needsCategory && !selCatId) || saving ? T.subtle : '#fff',
          border: 'none',
          borderRadius: 10,
          padding: 13,
          fontSize: 14,
          fontWeight: 700,
          cursor: !amount || !selAccId || (needsCategory && !selCatId) || saving ? 'not-allowed' : 'pointer',
          boxShadow:
            !amount || !selAccId || (needsCategory && !selCatId) || saving ? 'none' : `0 4px 16px ${typeColor}44`,
          marginTop: 2,
          transition: 'background .15s',
        }}
      >
        {saving ? 'Saving…' : `Save ${txType.charAt(0).toUpperCase() + txType.slice(1)}`}
      </button>
    </div>
  );
}
