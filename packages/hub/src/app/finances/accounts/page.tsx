'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, AddButton } from '../ui';
import { AddAccountModal } from './AddAccountModal';
import { AccountProgressBar } from './AccountProgressBar';
import { BorrowedLentDetails } from './BorrowedLentDetails';
import { NetWorthSummary } from './NetWorthSummary';
import { AccountsPageSkeleton } from './AccountsPageSkeleton';
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
        <AccountProgressBar
          value={acc.balance}
          max={acc.creditLimit}
          currency={acc.currency}
          color="var(--fin-blue)"
          prefix="Used"
        />
      )}

      {acc.type === 'goal' && acc.targetAmount != null && (
        <AccountProgressBar
          value={acc.balance}
          max={acc.targetAmount}
          currency={acc.currency}
          color="var(--fin-green)"
        />
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

      {acc.type === 'borrowed_lent' && <BorrowedLentDetails acc={acc} onSettle={onSettle} />}
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
    return <AccountsPageSkeleton />;
  }

  if (!data) return null;

  const { currency, netWorth, netWorthHistory, accounts } = data;
  const byType = (type: string) => accounts.filter(a => a.type === type);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Accounts</div>
        <AddButton onClick={() => setShowAddModal(true)} title="Add account" />
      </div>

      <NetWorthSummary netWorth={netWorth} currency={currency} history={netWorthHistory} />

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
