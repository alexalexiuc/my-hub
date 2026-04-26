'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel, Pill, Bar, Divider, TYPE_META } from '../../ui';
import { categoryIconEmoji } from '../../categoryIcons';
import type { AccountDetailData, AccountItem } from '../types';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function CorrectionForm({
  accountId,
  currency,
  onSaved,
}: {
  accountId: number;
  currency: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!amount) return;
    setSaving(true);
    try {
      await apiFetch('/api/finances/transactions', {
        method: 'POST',
        body: {
          type: txType,
          accountId,
          amount: parseFloat(amount),
          date,
          notes: notes.trim() || 'Balance Correction',
          isCorrection: true,
        },
        silentToast: true,
      });
      setOpen(false);
      setAmount('');
      setNotes('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: T.card2,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 12,
          color: T.muted,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        + Add Correction
      </button>
    );
  }

  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>Balance Correction</div>
      <div
        style={{ display: 'flex', background: T.card2, padding: 3, borderRadius: 8, border: `1px solid ${T.border}` }}
      >
        {(['income', 'expense'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTxType(t)}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 6,
              border: 'none',
              background: txType === t ? (t === 'income' ? T.green : T.red) + '22' : 'transparent',
              color: txType === t ? (t === 'income' ? T.green : T.red) : T.muted,
              fontSize: 11,
              fontWeight: txType === t ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px' }}>
          <div
            style={{
              fontSize: 9,
              color: T.subtle,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              marginBottom: 3,
            }}
          >
            Amount ({currency})
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.text,
              fontSize: 14,
              fontWeight: 600,
            }}
          />
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px' }}>
          <div
            style={{
              fontSize: 9,
              color: T.subtle,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              marginBottom: 3,
            }}
          >
            Date
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.text,
              fontSize: 13,
            }}
          />
        </div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px' }}>
        <div
          style={{ fontSize: 9, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}
        >
          Notes
        </div>
        <input
          placeholder="Balance Correction"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: T.text,
            fontSize: 13,
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setOpen(false)}
          style={{
            flex: 1,
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '8px',
            fontSize: 12,
            color: T.muted,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!amount || saving}
          style={{
            flex: 2,
            background: !amount || saving ? T.card3 : T.accent,
            border: 'none',
            borderRadius: 8,
            padding: '8px',
            fontSize: 12,
            fontWeight: 600,
            color: !amount || saving ? T.subtle : '#fff',
            cursor: !amount || saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save Correction'}
        </button>
      </div>
    </Card>
  );
}

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, color: T.muted };
  return <Pill label={meta.label} color={meta.color} />;
}

function AccountHeader({ acc }: { acc: AccountItem }) {
  const meta = TYPE_META[acc.type] ?? { color: T.muted };
  const isLiability = acc.type === 'loan' || acc.type === 'credit_card';

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${meta.color}18, ${T.card})`,
        border: `1px solid ${meta.color}33`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>{acc.name}</div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '-.02em',
          marginBottom: 8,
          color: isLiability ? T.red : T.text,
        }}
      >
        {acc.type === 'loan' ? '-' : ''}
        {fmt(acc.balance, acc.currency)}
      </div>

      {acc.type === 'credit_card' && acc.creditLimit != null && (
        <div>
          <Bar value={acc.balance} max={acc.creditLimit} color={meta.color} height={6} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 11, color: T.muted }}>
            {fmt(acc.creditLimit - acc.balance, acc.currency)} available
            {' · '}Limit {fmt(acc.creditLimit, acc.currency)}
            {acc.statementDay != null ? ` · Statement day ${acc.statementDay}` : ''}
          </div>
        </div>
      )}

      {acc.type === 'goal' && acc.targetAmount != null && (
        <div>
          <Bar value={acc.balance} max={acc.targetAmount} color={meta.color} height={6} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 11, color: T.muted }}>
            {fmt(acc.targetAmount - acc.balance, acc.currency)} to go · Target {fmt(acc.targetAmount, acc.currency)}
          </div>
        </div>
      )}

      {acc.type === 'investment' && acc.deposited != null && (
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: T.subtle }}>Deposited</div>
            <div style={{ color: T.muted }}>{fmt(acc.deposited, acc.currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.subtle }}>Unrealised P&L</div>
            <div style={{ color: acc.balance >= acc.deposited ? T.green : T.red }}>
              {acc.balance >= acc.deposited ? '+' : '-'}
              {fmt(Math.abs(acc.balance - acc.deposited), acc.currency)}
              {acc.deposited > 0 &&
                ` (${acc.balance >= acc.deposited ? '+' : ''}${(((acc.balance - acc.deposited) / acc.deposited) * 100).toFixed(1)}%)`}
            </div>
          </div>
        </div>
      )}

      {acc.type === 'loan' && acc.principal != null && (
        <div style={{ display: 'flex', gap: 20 }}>
          {acc.interestRate != null && (
            <div>
              <div style={{ fontSize: 10, color: T.subtle }}>Rate</div>
              <div style={{ color: T.muted }}>{acc.interestRate}%</div>
            </div>
          )}
          {acc.principal > 0 && (
            <div>
              <div style={{ fontSize: 10, color: T.subtle }}>Paid off</div>
              <div style={{ color: T.green }}>{Math.round(((acc.principal - acc.balance) / acc.principal) * 100)}%</div>
            </div>
          )}
        </div>
      )}

      {acc.type === 'borrowed_lent' && (
        <div style={{ display: 'flex', gap: 20 }}>
          {acc.direction && (
            <div>
              <div style={{ fontSize: 10, color: T.subtle }}>Direction</div>
              <div style={{ color: acc.direction === 'gave' ? T.green : T.amber, fontWeight: 600 }}>
                {acc.direction === 'gave' ? 'Lent' : 'Borrowed'}
              </div>
            </div>
          )}
          {acc.counterpartyName && (
            <div>
              <div style={{ fontSize: 10, color: T.subtle }}>With</div>
              <div style={{ color: T.muted }}>{acc.counterpartyName}</div>
            </div>
          )}
          {acc.dueDate && (
            <div>
              <div style={{ fontSize: 10, color: T.subtle }}>Due</div>
              <div style={{ color: T.amber }}>{acc.dueDate}</div>
            </div>
          )}
          {acc.settled && <div style={{ color: T.green, alignSelf: 'flex-end', fontSize: 12 }}>✓ Settled</div>}
        </div>
      )}
    </div>
  );
}

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const numericId = Number(params.id);
  const [data, setData] = useState<AccountDetailData | null>(null);
  const [loading, setLoading] = useState(!isNaN(numericId));

  const load = useCallback(async () => {
    const result = await apiFetch<AccountDetailData>(`/api/finances/accounts/${params.id}`, { silentToast: true });
    setData(result);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (isNaN(numericId)) {
      router.replace('/finances/accounts');
      return;
    }
    load();
  }, [load, numericId, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[44, 120, 300].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { account: acc, transactions } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Navigation row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => router.push('/finances/accounts')}
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
          ← Back
        </button>
        <TypeBadge type={acc.type} />
      </div>

      <AccountHeader acc={acc} />

      {acc.type === 'loan' && (
        <button
          onClick={() => router.push(`/finances/accounts/${acc.id}/amortization`)}
          style={{
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '10px 14px',
            color: T.text,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span>View amortization schedule</span>
          <span style={{ color: T.accent }}>→</span>
        </button>
      )}

      {/* Transaction ledger */}
      <Card style={{ padding: 14 }}>
        <SectionLabel style={{ marginBottom: 10 }}>Ledger</SectionLabel>

        {transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: T.subtle, fontSize: 13 }}>
            No transactions yet
          </div>
        )}

        {transactions.map((tx, i) => {
          const catColor = tx.categoryColor ?? (tx.isCorrection ? T.amber : T.muted);
          const label = tx.isCorrection ? (tx.notes ?? 'Balance Correction') : (tx.payeeName ?? tx.notes ?? '—');
          const isTransfer = tx.type === 'transfer';
          return (
            <div key={tx.id}>
              {i > 0 && <Divider />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: catColor + '22',
                    border: `1px solid ${catColor}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                  }}
                >
                  {tx.isCorrection ? '⚖' : isTransfer ? '↔' : categoryIconEmoji(tx.categoryIcon)}
                </div>
                <span
                  style={{ fontSize: 13, fontWeight: 500, color: tx.isCorrection ? T.amber : T.text, flexShrink: 0 }}
                >
                  {label}
                </span>
                {tx.categoryName && <Pill label={tx.categoryName} color={catColor} />}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: T.subtle, flexShrink: 0 }}>{tx.date}</span>
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: tx.type === 'income' ? T.green : isTransfer ? T.blue : T.red,
                    }}
                  >
                    {fmt(tx.amount, acc.currency)}
                  </div>
                  {tx.balanceAfter != null && (
                    <div style={{ fontSize: 10, color: T.subtle }}>{fmt(tx.balanceAfter, acc.currency)}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      <CorrectionForm accountId={acc.id} currency={acc.currency} onSaved={load} />
    </div>
  );
}
