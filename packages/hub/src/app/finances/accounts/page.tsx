'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar, Sparkline } from '../ui';
import { AddAccountModal } from './AddAccountModal';
import type { AccountsListData, AccountItem } from './types';

const ACCOUNT_GROUPS = [
  { key: 'bank', label: 'Bank', icon: '🏦' },
  { key: 'investment', label: 'Investments', icon: '📈' },
  { key: 'credit_card', label: 'Credit Cards', icon: '💳' },
  { key: 'loan', label: 'Loans', icon: '🏷' },
  { key: 'goal', label: 'Goals', icon: '🎯' },
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'tracking', label: 'Tracking', icon: '👁' },
  { key: 'borrowed_lent', label: 'Borrowed/Lent', icon: '🤝' },
] as const;

function AccountCard({
  acc,
  onSettle,
  onClick,
}: {
  acc: AccountItem;
  currency: string;
  onSettle: (id: number) => void;
  onClick: () => void;
}) {
  const isLiability = acc.type === 'credit_card' || acc.type === 'loan';
  const hasExtra = acc.type === 'credit_card' || acc.type === 'goal' || acc.type === 'investment';

  return (
    <Card onClick={onClick} className="cursor-pointer px-[14px] py-3">
      <div className={cn('flex items-center justify-between', hasExtra ? 'mb-[10px]' : 'mb-0')}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--fin-muted)]" />
          <div>
            <div className="text-sm font-semibold text-[var(--fin-text)]">{acc.name}</div>
            {acc.cardLastFour && <div className="text-[10px] text-[var(--fin-subtle)]">•••• {acc.cardLastFour}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-base font-bold', isLiability ? 'text-[var(--fin-red)]' : 'text-[var(--fin-text)]')}>
            {acc.type === 'loan' ? '-' : ''}
            {fmt(acc.balance, acc.currency)}
          </div>
        </div>
      </div>

      {acc.type === 'credit_card' && acc.creditLimit != null && (
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-[10px] text-[var(--fin-muted)]">
              Used {fmt(acc.balance, acc.currency)} of {fmt(acc.creditLimit, acc.currency)}
            </span>
            <span className="text-[10px] text-[var(--fin-muted)]">
              {Math.round((acc.balance / acc.creditLimit) * 100)}%
            </span>
          </div>
          <Bar value={acc.balance} max={acc.creditLimit} color={'var(--fin-blue)'} height={4} />
        </div>
      )}

      {acc.type === 'goal' && acc.targetAmount != null && (
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-[10px] text-[var(--fin-muted)]">
              {fmt(acc.balance, acc.currency)} of {fmt(acc.targetAmount, acc.currency)}
            </span>
            <span className="text-[10px] text-[var(--fin-green)]">
              {Math.round((acc.balance / acc.targetAmount) * 100)}%
            </span>
          </div>
          <Bar value={acc.balance} max={acc.targetAmount} color={'var(--fin-green)'} height={4} />
        </div>
      )}

      {acc.type === 'investment' && acc.deposited != null && (
        <div className="flex gap-4">
          <div>
            <div className="text-[10px] text-[var(--fin-subtle)]">Deposited</div>
            <div className="text-xs text-[var(--fin-muted)]">{fmt(acc.deposited, acc.currency)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--fin-subtle)]">P&L</div>
            <div
              className={cn(
                'text-xs',
                acc.balance >= acc.deposited ? 'text-[var(--fin-green)]' : 'text-[var(--fin-red)]',
              )}
            >
              {acc.balance >= acc.deposited ? '+' : '-'}
              {fmt(Math.abs(acc.balance - acc.deposited), acc.currency)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--fin-subtle)]">Return</div>
            <div
              className={cn(
                'text-xs',
                acc.balance >= acc.deposited ? 'text-[var(--fin-green)]' : 'text-[var(--fin-red)]',
              )}
            >
              {acc.deposited > 0
                ? `${acc.balance >= acc.deposited ? '+' : ''}${(((acc.balance - acc.deposited) / acc.deposited) * 100).toFixed(1)}%`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {acc.type === 'tracking' && (
        <div className="text-[10px] text-[var(--fin-subtle)]">Manually tracked value · read-only</div>
      )}

      {acc.type === 'borrowed_lent' && (
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.06em] text-[var(--fin-subtle)]">Direction</div>
              <div
                className={cn(
                  'text-xs font-semibold',
                  acc.direction === 'gave' ? 'text-[var(--fin-green)]' : 'text-[var(--fin-amber)]',
                )}
              >
                {acc.direction === 'gave' ? 'Lent' : 'Borrowed'}
              </div>
            </div>
            {acc.counterpartyName && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.06em] text-[var(--fin-subtle)]">With</div>
                <div className="text-xs text-[var(--fin-muted)]">{acc.counterpartyName}</div>
              </div>
            )}
            {acc.dueDate && (
              <div>
                <div className="text-[9px] uppercase tracking-[0.06em] text-[var(--fin-subtle)]">Due</div>
                <div className="text-xs text-[var(--fin-amber)]">{acc.dueDate}</div>
              </div>
            )}
            {acc.settled && <div className="self-center text-[11px] text-[var(--fin-green)]">✓ Settled</div>}
          </div>
          {!acc.settled && (
            <button
              onClick={e => {
                e.stopPropagation();
                onSettle(acc.id);
              }}
              className="cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-semibold bg-[var(--fin-teal-d)] text-[var(--fin-teal)]"
              style={{ border: `1px solid var(--fin-teal)44` }}
            >
              Settle
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AccountsPage() {
  const router = useRouter();
  const [data, setData] = useState<AccountsListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<AccountsListData>('/api/finances/accounts', { silentToast: true });
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSettle(accountId: number) {
    await apiFetch(`/api/finances/accounts/${accountId}`, { method: 'PATCH', body: { action: 'settle' } });
    load();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[80, 120, 100].map((h, i) => (
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

  const { currency, netWorth, netWorthHistory, accounts } = data;
  const byType = (type: string) => accounts.filter(a => a.type === type);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Accounts</div>
        <button
          onClick={() => setShowAddModal(true)}
          className="cursor-pointer rounded-[20px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-1.5 text-[11px] text-[var(--fin-muted)]"
        >
          + New Account
        </button>
      </div>

      {/* Net worth summary */}
      <div
        className="flex items-center justify-between rounded-xl p-4"
        style={{
          background: `linear-gradient(135deg, var(--fin-accent)18, var(--fin-violet)18)`,
          border: `1px solid var(--fin-accent)33`,
        }}
      >
        <div>
          <div className="mb-1 text-[11px] text-[var(--fin-muted)]">Total Net Worth</div>
          <div className="text-[26px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">
            {fmt(netWorth, currency)}
          </div>
        </div>
        <Sparkline data={netWorthHistory} color={'var(--fin-green)'} width={80} height={40} />
      </div>

      {ACCOUNT_GROUPS.map(({ key, label, icon }) => {
        const accs = byType(key);
        if (!accs.length) return null;
        return (
          <div key={key}>
            <SectionLabel>
              {icon} {label}
            </SectionLabel>
            <div className="flex flex-col gap-2">
              {accs.map(acc => (
                <AccountCard
                  key={acc.id}
                  acc={acc}
                  currency={currency}
                  onSettle={handleSettle}
                  onClick={() => router.push(`/finances/accounts/${acc.id}`)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {accounts.length === 0 && (
        <div className="py-12 text-center text-[13px] text-[var(--fin-subtle)]">
          No accounts yet. Add your first account to get started.
        </div>
      )}

      {showAddModal && (
        <AddAccountModal
          defaultCurrency={currency}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
