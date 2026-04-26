'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel, Bar, Pill, TYPE_META } from '../../ui';
import { TransactionList } from '../../transactions/TransactionList';
import type { AccountDetailData, AccountItem } from '../types';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function CorrectionModal({
  accountId,
  currency,
  currentBalance,
  onClose,
  onSaved,
}: {
  accountId: number;
  currency: string;
  currentBalance: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newBalance, setNewBalance] = useState(String(currentBalance));
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = parseFloat(newBalance);
  const correction = isNaN(parsed) ? 0 : parsed - currentBalance;
  const isZero = correction === 0;
  const correctionColor = correction > 0 ? T.green : correction < 0 ? T.red : T.subtle;

  async function handleSave() {
    if (isZero || saving) return;
    setSaving(true);
    try {
      await apiFetch('/api/finances/transactions', {
        method: 'POST',
        body: {
          type: correction > 0 ? 'income' : 'expense',
          accountId,
          amount: Math.abs(correction),
          date,
          notes: notes.trim() || 'Balance Correction',
          isCorrection: true,
        },
        silentToast: true,
      });
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 20,
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Balance Correction</div>

        {/* Balance summary row */}
        <div
          style={{
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                color: T.subtle,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 2,
              }}
            >
              Current
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.muted }}>{fmt(currentBalance, currency)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: correctionColor,
                minWidth: 60,
                padding: '3px 8px',
                borderRadius: 6,
                background: isZero ? 'transparent' : correctionColor + '18',
              }}
            >
              {isZero ? '—' : `${correction > 0 ? '+' : ''}${fmt(correction, currency)}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 9,
                color: T.subtle,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 2,
              }}
            >
              New
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: isZero ? T.muted : T.text }}>
              {isNaN(parsed) ? '—' : fmt(parsed, currency)}
            </div>
          </div>
        </div>

        {/* New balance input */}
        <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px' }}>
          <div
            style={{
              fontSize: 9,
              color: T.subtle,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              marginBottom: 4,
            }}
          >
            Actual Balance ({currency})
          </div>
          <input
            autoFocus
            type="number"
            placeholder={String(currentBalance)}
            value={newBalance}
            onChange={e => setNewBalance(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.text,
              fontSize: 20,
              fontWeight: 700,
            }}
          />
        </div>

        {/* Date + Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div
              style={{
                fontSize: 9,
                color: T.subtle,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 4,
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
          <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div
              style={{
                fontSize: 9,
                color: T.subtle,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 4,
              }}
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
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: T.card2,
              border: `1px solid ${T.border}`,
              color: T.muted,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isZero || saving}
            style={{
              flex: 2,
              padding: '10px 0',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              background: isZero || saving ? T.card3 : correctionColor,
              border: 'none',
              color: isZero || saving ? T.subtle : '#fff',
              cursor: isZero || saving ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {saving ? 'Saving…' : 'Apply Correction'}
          </button>
        </div>
      </div>
    </div>
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
  const [correctionOpen, setCorrectionOpen] = useState(false);

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

        <TransactionList transactions={transactions} currency={acc.currency} />
      </Card>

      <button
        onClick={() => setCorrectionOpen(true)}
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

      {correctionOpen && (
        <CorrectionModal
          accountId={acc.id}
          currency={acc.currency}
          currentBalance={acc.balance}
          onClose={() => setCorrectionOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
