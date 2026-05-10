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
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'credit_card', label: 'Credit Cards', icon: '💳' },
  { key: 'goal', label: 'Goals', icon: '🎯' },
  { key: 'loan', label: 'Loans', icon: '🏷' },
  { key: 'borrowed_lent', label: 'Borrowed/Lent', icon: '🤝' },
  { key: 'investment', label: 'Investments', icon: '📈' },
  { key: 'tracking', label: 'Tracking', icon: '👁' },
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
  const hasExtra = acc.type === 'credit_card' || acc.type === 'goal';

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
  const [showArchived, setShowArchived] = useState(false);

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
  const activeAccounts = accounts.filter(a => !a.archived);
  const archivedAccounts = accounts.filter(a => a.archived);
  const byType = (type: string) => activeAccounts.filter(a => a.type === type);

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

      {activeAccounts.length === 0 && archivedAccounts.length === 0 && (
        <div className="py-12 text-center text-[13px] text-[var(--fin-subtle)]">
          No accounts yet. Add your first account to get started.
        </div>
      )}

      {archivedAccounts.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-[14px] py-[10px] text-left text-[13px] text-[var(--fin-muted)]"
          >
            <span className={cn('transition-transform', showArchived ? 'rotate-90' : 'rotate-0')}>▶</span>
            <span>Archived accounts ({archivedAccounts.length})</span>
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-2">
              {archivedAccounts.map(acc => (
                <AccountCard
                  key={acc.id}
                  acc={acc}
                  currency={currency}
                  onSettle={handleSettle}
                  onClick={() => router.push(`/finances/accounts/${acc.id}`)}
                />
              ))}
            </div>
          )}
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
