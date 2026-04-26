'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar, Pill, TYPE_META } from '../../ui';
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
  const correctionColor = correction > 0 ? 'var(--fin-green)' : correction < 0 ? 'var(--fin-red)' : 'var(--fin-subtle)';

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
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{
        background: 'var(--fin-overlay)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex w-full max-w-[400px] flex-col gap-3 rounded-[14px] p-5"
        style={{
          background: 'var(--fin-card)',
          border: `1px solid ${'var(--fin-border)'}`,
        }}
      >
        <div className="text-base font-bold" style={{ color: 'var(--fin-text)' }}>
          Balance Correction
        </div>

        {/* Balance summary row */}
        <div
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[10px] px-[14px] py-3"
          style={{
            background: 'var(--fin-card2)',
            border: `1px solid ${'var(--fin-border)'}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--fin-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 2,
              }}
            >
              Current
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fin-muted)' }}>
              {fmt(currentBalance, currency)}
            </div>
          </div>
          <div className="text-center">
            <div
              className="min-w-[60px] rounded-md px-2 py-[3px] text-[13px] font-bold"
              style={{
                color: correctionColor,
                background: isZero ? 'transparent' : correctionColor + '18',
              }}
            >
              {isZero ? '—' : `${correction > 0 ? '+' : ''}${fmt(correction, currency)}`}
            </div>
          </div>
          <div className="text-right">
            <div
              style={{
                fontSize: 9,
                color: 'var(--fin-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 2,
              }}
            >
              New
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: isZero ? 'var(--fin-muted)' : 'var(--fin-text)' }}>
              {isNaN(parsed) ? '—' : fmt(parsed, currency)}
            </div>
          </div>
        </div>

        {/* New balance input */}
        <div
          className="rounded-[10px] px-[14px] py-[10px]"
          style={{ background: 'var(--fin-card2)', border: `1px solid ${'var(--fin-border)'}` }}
        >
          <div
            style={{
              fontSize: 9,
              color: 'var(--fin-subtle)',
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
              color: 'var(--fin-text)',
              fontSize: 20,
              fontWeight: 700,
            }}
          />
        </div>

        {/* Date + Notes */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-[10px] px-3 py-[10px]"
            style={{ background: 'var(--fin-card2)', border: `1px solid ${'var(--fin-border)'}` }}
          >
            <div
              style={{
                fontSize: 9,
                color: 'var(--fin-subtle)',
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
                color: 'var(--fin-text)',
                fontSize: 13,
              }}
            />
          </div>
          <div
            className="rounded-[10px] px-3 py-[10px]"
            style={{ background: 'var(--fin-card2)', border: `1px solid ${'var(--fin-border)'}` }}
          >
            <div
              style={{
                fontSize: 9,
                color: 'var(--fin-subtle)',
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
                color: 'var(--fin-text)',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-[13px] font-semibold"
            style={{
              background: 'var(--fin-card2)',
              border: `1px solid ${'var(--fin-border)'}`,
              color: 'var(--fin-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isZero || saving}
            className="flex-[2] rounded-lg border-none py-2.5 text-[13px] font-bold"
            style={{
              background: isZero || saving ? 'var(--fin-card3)' : correctionColor,
              border: 'none',
              color: isZero || saving ? 'var(--fin-subtle)' : 'var(--fin-on-solid)',
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
  const meta = TYPE_META[type] ?? { label: type, color: 'var(--fin-muted)' };
  return <Pill label={meta.label} color={meta.color} />;
}

function AccountHeader({ acc }: { acc: AccountItem }) {
  const meta = TYPE_META[acc.type] ?? { color: 'var(--fin-muted)' };
  const isLiability = acc.type === 'loan' || acc.type === 'credit_card';

  return (
    <div
      className="rounded-xl p-[18px]"
      style={{
        background: `linear-gradient(135deg, ${meta.color}18, ${'var(--fin-card)'})`,
        border: `1px solid ${meta.color}33`,
      }}
    >
      <div className="mb-1 text-[13px]" style={{ color: 'var(--fin-muted)' }}>
        {acc.name}
      </div>
      <div
        className="mb-2 text-[30px] font-bold tracking-[-0.02em]"
        style={{
          color: isLiability ? 'var(--fin-red)' : 'var(--fin-text)',
        }}
      >
        {acc.type === 'loan' ? '-' : ''}
        {fmt(acc.balance, acc.currency)}
      </div>

      {acc.type === 'credit_card' && acc.creditLimit != null && (
        <div>
          <Bar value={acc.balance} max={acc.creditLimit} color={meta.color} height={6} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 11, color: 'var(--fin-muted)' }}>
            {fmt(acc.creditLimit - acc.balance, acc.currency)} available
            {' · '}Limit {fmt(acc.creditLimit, acc.currency)}
            {acc.statementDay != null ? ` · Statement day ${acc.statementDay}` : ''}
          </div>
        </div>
      )}

      {acc.type === 'goal' && acc.targetAmount != null && (
        <div>
          <Bar value={acc.balance} max={acc.targetAmount} color={meta.color} height={6} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 11, color: 'var(--fin-muted)' }}>
            {fmt(acc.targetAmount - acc.balance, acc.currency)} to go · Target {fmt(acc.targetAmount, acc.currency)}
          </div>
        </div>
      )}

      {acc.type === 'investment' && acc.deposited != null && (
        <div className="flex gap-5">
          <div>
            <div style={{ fontSize: 10, color: 'var(--fin-subtle)' }}>Deposited</div>
            <div style={{ color: 'var(--fin-muted)' }}>{fmt(acc.deposited, acc.currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--fin-subtle)' }}>Unrealised P&L</div>
            <div style={{ color: acc.balance >= acc.deposited ? 'var(--fin-green)' : 'var(--fin-red)' }}>
              {acc.balance >= acc.deposited ? '+' : '-'}
              {fmt(Math.abs(acc.balance - acc.deposited), acc.currency)}
              {acc.deposited > 0 &&
                ` (${acc.balance >= acc.deposited ? '+' : ''}${(((acc.balance - acc.deposited) / acc.deposited) * 100).toFixed(1)}%)`}
            </div>
          </div>
        </div>
      )}

      {acc.type === 'loan' && acc.principal != null && (
        <div className="flex gap-5">
          {acc.interestRate != null && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fin-subtle)' }}>Rate</div>
              <div style={{ color: 'var(--fin-muted)' }}>{acc.interestRate}%</div>
            </div>
          )}
          {acc.principal > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fin-subtle)' }}>Paid off</div>
              <div style={{ color: 'var(--fin-green)' }}>
                {Math.round(((acc.principal - acc.balance) / acc.principal) * 100)}%
              </div>
            </div>
          )}
        </div>
      )}

      {acc.type === 'borrowed_lent' && (
        <div className="flex gap-5">
          {acc.direction && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fin-subtle)' }}>Direction</div>
              <div
                style={{ color: acc.direction === 'gave' ? 'var(--fin-green)' : 'var(--fin-amber)', fontWeight: 600 }}
              >
                {acc.direction === 'gave' ? 'Lent' : 'Borrowed'}
              </div>
            </div>
          )}
          {acc.counterpartyName && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fin-subtle)' }}>With</div>
              <div style={{ color: 'var(--fin-muted)' }}>{acc.counterpartyName}</div>
            </div>
          )}
          {acc.dueDate && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--fin-subtle)' }}>Due</div>
              <div style={{ color: 'var(--fin-amber)' }}>{acc.dueDate}</div>
            </div>
          )}
          {acc.settled && (
            <div className="self-end text-xs" style={{ color: 'var(--fin-green)' }}>
              ✓ Settled
            </div>
          )}
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
      <div className="flex flex-col gap-[14px]">
        {[44, 120, 300].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border"
            style={{ height: h, background: 'var(--fin-card)', borderColor: 'var(--fin-border)', opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { account: acc, transactions } = data;

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Navigation row */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => router.push('/finances/accounts')}
          className="rounded-md border bg-transparent px-2.5 py-[5px] text-xs"
          style={{
            border: `1px solid ${'var(--fin-border)'}`,
            color: 'var(--fin-muted)',
            cursor: 'pointer',
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
          className="flex w-full items-center justify-between rounded-lg px-[14px] py-[10px] text-left text-[13px]"
          style={{
            background: 'var(--fin-card2)',
            border: `1px solid ${'var(--fin-border)'}`,
            color: 'var(--fin-text)',
            cursor: 'pointer',
          }}
        >
          <span>View amortization schedule</span>
          <span style={{ color: 'var(--fin-accent)' }}>→</span>
        </button>
      )}

      {/* Transaction ledger */}
      <Card className="p-[14px]">
        <SectionLabel style={{ marginBottom: 10 }}>Ledger</SectionLabel>

        <TransactionList transactions={transactions} currency={acc.currency} />
      </Card>

      <button
        onClick={() => setCorrectionOpen(true)}
        className="w-full rounded-lg px-[14px] py-2 text-xs"
        style={{
          background: 'var(--fin-card2)',
          border: `1px solid ${'var(--fin-border)'}`,
          color: 'var(--fin-muted)',
          cursor: 'pointer',
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
