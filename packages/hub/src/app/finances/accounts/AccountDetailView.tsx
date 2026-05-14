'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Pill, Button } from '@/components';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar, TYPE_META } from '../ui';
import { TransactionList } from '../transactions/TransactionList';
import { EditAccountModal } from './EditAccountModal';
import type { AccountItem } from '@/app/api/finances/accounts/route';
import type { AccountDetailData } from '@/app/api/finances/accounts/[id]/route';
import type { TransactionMutationResponse } from '@/app/api/finances/transactions/route';
import { TransactionType, TransactionTypes } from '@my-hub/shared/constants';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sortAccountTransactions(transactions: AccountDetailData['transactions']) {
  return [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return right.id - left.id;
  });
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
  onSaved: (result?: TransactionMutationResponse) => void;
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
      const result = await apiFetch<TransactionMutationResponse>('/api/finances/transactions', {
        method: 'POST',
        body: {
          type: correction > 0 ? TransactionTypes.Income : TransactionTypes.Expense,
          accountId,
          amount: Math.abs(correction),
          date,
          notes: notes.trim() || 'Balance Correction',
          isCorrection: true,
        },
        silentToast: true,
      });
      onClose();
      onSaved(result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--fin-overlay)]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex w-full max-w-[400px] flex-col gap-3 rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="text-base font-bold text-[var(--fin-text)]">Balance Correction</div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-[14px] py-3">
          <div>
            <div className="mb-0.5 text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">Current</div>
            <div className="text-[15px] font-semibold text-[var(--fin-muted)]">{fmt(currentBalance, currency)}</div>
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
            <div className="mb-0.5 text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">New</div>
            <div
              className={cn('text-[15px] font-semibold', isZero ? 'text-[var(--fin-muted)]' : 'text-[var(--fin-text)]')}
            >
              {isNaN(parsed) ? '—' : fmt(parsed, currency)}
            </div>
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-[14px] py-[10px]">
          <div className="mb-1 text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">
            Actual Balance ({currency})
          </div>
          <input
            autoFocus
            type="number"
            placeholder={String(currentBalance)}
            value={newBalance}
            onChange={e => setNewBalance(e.target.value)}
            className="w-full border-none bg-transparent text-[20px] font-bold text-[var(--fin-text)] outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-[10px]">
            <div className="mb-1 text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">Date</div>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border-none bg-transparent text-[13px] text-[var(--fin-text)] outline-none"
            />
          </div>
          <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-[10px]">
            <div className="mb-1 text-[9px] uppercase tracking-[0.07em] text-[var(--fin-subtle)]">Notes</div>
            <input
              placeholder="Balance Correction"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border-none bg-transparent text-[13px] text-[var(--fin-text)] outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] py-2.5 text-[13px] font-semibold text-[var(--fin-muted)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isZero || saving}
            className={cn(
              'flex-[2] rounded-lg border-none py-2.5 text-[13px] font-bold',
              isZero || saving
                ? 'cursor-not-allowed text-[var(--fin-subtle)]'
                : 'cursor-pointer text-[var(--fin-on-solid)]',
            )}
            style={{
              background: isZero || saving ? 'var(--fin-card3)' : correctionColor,
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
        background: `linear-gradient(135deg, ${meta.color}18, var(--fin-card))`,
        border: `1px solid ${meta.color}33`,
      }}
    >
      <div className="mb-1 text-[13px] text-[var(--fin-muted)]">{acc.name}</div>
      <div
        className={cn(
          'mb-2 text-[30px] font-bold tracking-[-0.02em]',
          isLiability ? 'text-[var(--fin-red)]' : 'text-[var(--fin-text)]',
        )}
      >
        {acc.type === 'loan' ? '-' : ''}
        {fmt(acc.balance, acc.currency)}
      </div>

      {acc.type === 'credit_card' && acc.creditLimit != null && (
        <div>
          <Bar value={acc.balance} max={acc.creditLimit} color={meta.color} height={6} className="mb-1.5" />
          <div className="text-[11px] text-[var(--fin-muted)]">
            {fmt(acc.creditLimit - acc.balance, acc.currency)} available
            {' · '}Limit {fmt(acc.creditLimit, acc.currency)}
            {acc.statementDay != null ? ` · Statement day ${acc.statementDay}` : ''}
          </div>
        </div>
      )}

      {acc.type === 'goal' && acc.targetAmount != null && (
        <div>
          <Bar value={acc.balance} max={acc.targetAmount} color={meta.color} height={6} className="mb-1.5" />
          <div className="text-[11px] text-[var(--fin-muted)]">
            {fmt(acc.targetAmount - acc.balance, acc.currency)} to go · Target {fmt(acc.targetAmount, acc.currency)}
          </div>
        </div>
      )}

      {acc.type === 'investment' && acc.deposited != null && (
        <div className="flex gap-5">
          <div>
            <div className="text-[10px] text-[var(--fin-subtle)]">Deposited</div>
            <div className="text-[var(--fin-muted)]">{fmt(acc.deposited, acc.currency)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--fin-subtle)]">Unrealised P&L</div>
            <div className={acc.balance >= acc.deposited ? 'text-[var(--fin-green)]' : 'text-[var(--fin-red)]'}>
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
              <div className="text-[10px] text-[var(--fin-subtle)]">Rate</div>
              <div className="text-[var(--fin-muted)]">{acc.interestRate}%</div>
            </div>
          )}
          {acc.principal > 0 && (
            <div>
              <div className="text-[10px] text-[var(--fin-subtle)]">Paid off</div>
              <div className="text-[var(--fin-green)]">
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
              <div className="text-[10px] text-[var(--fin-subtle)]">Direction</div>
              <div
                className={cn(
                  'font-semibold',
                  acc.direction === 'gave' ? 'text-[var(--fin-green)]' : 'text-[var(--fin-amber)]',
                )}
              >
                {acc.direction === 'gave' ? 'Lent' : 'Borrowed'}
              </div>
            </div>
          )}
          {acc.counterpartyName && (
            <div>
              <div className="text-[10px] text-[var(--fin-subtle)]">With</div>
              <div className="text-[var(--fin-muted)]">{acc.counterpartyName}</div>
            </div>
          )}
          {acc.dueDate && (
            <div>
              <div className="text-[10px] text-[var(--fin-subtle)]">Due</div>
              <div className="text-[var(--fin-amber)]">{acc.dueDate}</div>
            </div>
          )}
          {acc.settled && <div className="self-end text-xs text-[var(--fin-green)]">✓ Settled</div>}
        </div>
      )}
    </div>
  );
}

type AccountDetailViewProps = {
  backPath: string;
};

export function AccountDetailView({ backPath }: AccountDetailViewProps) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const numericId = Number(params.id);
  const [data, setData] = useState<AccountDetailData | null>(null);
  const [loading, setLoading] = useState(!isNaN(numericId));
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<AccountDetailData>(`/api/finances/accounts/${params.id}`, { silentToast: true });
    setData(result);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (isNaN(numericId)) {
      router.replace(backPath);
      return;
    }
    load();
  }, [load, numericId, router, backPath]);

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[44, 120, 300].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
            style={{ height: h, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { account: acc, transactions } = data;

  async function handleArchive() {
    await apiFetch(`/api/finances/accounts/${acc.id}`, {
      method: 'PATCH',
      body: { action: acc.archived ? 'unarchive' : 'archive' },
      silentToast: true,
    });
    load();
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push(backPath)}
            className="cursor-pointer rounded-md border border-[var(--fin-border)] bg-transparent px-2.5 py-[5px] text-xs text-[var(--fin-muted)]"
          >
            ← Back
          </button>
          <TypeBadge type={acc.type} />
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="xs" variant="primary" onClick={() => setCorrectionOpen(true)}>
            + Correction
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
            onClick={handleArchive}
          >
            {acc.archived ? 'Unarchive' : 'Archive'}
          </Button>
        </div>
      </div>

      <AccountHeader acc={acc} />

      {acc.type === 'loan' && (
        <button
          onClick={() => router.push(`/finances/accounts/${acc.id}/amortization`)}
          className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-[14px] py-[10px] text-left text-[13px] text-[var(--fin-text)]"
        >
          <span>View amortization schedule</span>
          <span className="text-[var(--fin-accent)]">→</span>
        </button>
      )}

      <Card className="p-[14px]">
        <SectionLabel className="mb-2.5">Ledger</SectionLabel>
        <TransactionList transactions={transactions} currency={acc.currency} />
      </Card>

      {editOpen && (
        <EditAccountModal
          acc={acc}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      )}

      {correctionOpen && (
        <CorrectionModal
          accountId={acc.id}
          currency={acc.currency}
          currentBalance={acc.balance}
          onClose={() => setCorrectionOpen(false)}
          onSaved={result => {
            setCorrectionOpen(false);

            if (!result?.transaction) {
              load();
              return;
            }

            setData(prev => {
              if (!prev) return prev;

              const tx = result.transaction as Record<string, unknown>;
              const nextTransaction = {
                id: result.transaction.id,
                date: tx.date as string,
                amount: tx.amount as number,
                type: tx.type as TransactionType,
                notes: (tx.notes as string | null | undefined) ?? null,
                payeeName: null,
                categoryName: null,
                categoryColor: null,
                categoryIcon: null,
                balanceAfter: (tx.fromAccountBalanceAfter as number | null | undefined) ?? null,
                isCorrection: (tx.isCorrection as boolean | undefined) ?? true,
                accountName: prev.account.name,
                addedByInitials: null,
              };

              return {
                account: {
                  ...prev.account,
                  balance: (tx.fromAccountBalanceAfter as number | null | undefined) ?? prev.account.balance,
                },
                transactions: sortAccountTransactions([
                  nextTransaction,
                  ...prev.transactions.filter(transaction => transaction.id !== nextTransaction.id),
                ]),
              };
            });
          }}
        />
      )}
    </div>
  );
}
