'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn, apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, AddButton, Sparkline } from '../ui';
import { IconButton } from '@/components';
import { QuestionMarkIcon } from '@/components/icons';
import { AddAccountModal } from './AddAccountModal';
import { AccountProgressBar } from './AccountProgressBar';
import { BorrowedLentDetails } from './BorrowedLentDetails';
import { AccountsPageSkeleton } from './AccountsPageSkeleton';
import { AvailableBalanceSheet } from './AvailableBalanceSheet';
import { NetWorthSheet } from './NetWorthSheet';
import type { AccountItem, AccountsListData } from '@/app/api/finances/accounts/route';
import { LIABILITY_ACCOUNT_TYPES } from '@my-hub/shared/constants';
import type { AccountType } from '@my-hub/shared/constants';
import { groupAccountsByCurrency } from './accounts.utils';

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

function amountColor(balance: number, type: AccountType): string {
  if (LIABILITY_ACCOUNT_TYPES.has(type)) return 'text-[var(--fin-red)]';
  if (balance > 0) return 'text-[var(--fin-green)]';
  if (balance < 0) return 'text-[var(--fin-red)]';
  return 'text-[var(--fin-text)]';
}

function AccountCard({
  acc,
  onSettle,
  onClick,
}: {
  acc: AccountItem;
  onSettle: (id: number) => void;
  onClick: () => void;
}) {
  const hasExtra = acc.type === 'credit_card' || acc.type === 'goal';

  return (
    <Card onClick={onClick} className="cursor-pointer px-[14px] py-3">
      <div className={cn('flex items-center justify-between', hasExtra ? 'mb-[10px]' : 'mb-0')}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--fin-muted)]" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fin-text)] truncate">{acc.name}</div>
            {acc.cardLastFour && <div className="text-[10px] text-[var(--fin-subtle)]">•••• {acc.cardLastFour}</div>}
          </div>
        </div>
        <div
          className={cn(
            'text-base font-bold tabular-nums text-right shrink-0 ml-2',
            amountColor(acc.balance, acc.type as AccountType),
          )}
        >
          {fmt(acc.balance, acc.currency)}
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showAvailableSheet, setShowAvailableSheet] = useState(false);
  const [showNetWorthSheet, setShowNetWorthSheet] = useState(false);

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

  async function handleToggleInclusion(accountId: number, currentlyIncluded: boolean) {
    await apiFetch(`/api/finances/accounts/${accountId}`, {
      method: 'PATCH',
      body: { action: 'setAvailableInclusion', include: !currentlyIncluded },
      silentToast: true,
    });
    load();
  }

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) {
    return <AccountsPageSkeleton />;
  }

  if (!data) return null;

  const { currency, availableBalance, netWorth, netWorthHistory, accounts } = data;
  const activeAccounts = accounts.filter(a => !a.archived);
  const archivedAccounts = accounts.filter(a => a.archived);
  const byType = (type: string) => activeAccounts.filter(a => a.type === type);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Accounts</div>
        <AddButton onClick={() => setShowAddModal(true)} title="Add account" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card compact className="relative p-[14px]">
          <IconButton
            label="What is net worth?"
            icon={<QuestionMarkIcon className="size-3.5" />}
            onClick={() => setShowNetWorthSheet(true)}
            className="absolute right-[10px] top-[10px] bg-transparent p-1 text-[var(--fin-muted)] hover:bg-[var(--fin-card2)] hover:text-[var(--fin-accent)]"
          />
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">Net Worth</div>
          <div className="mb-2 text-[15px] font-bold tracking-[-0.02em] text-[var(--fin-text)] break-all leading-tight">
            {fmt(netWorth, currency)}
          </div>
          <Sparkline data={netWorthHistory} color="var(--fin-green)" width={80} height={28} />
        </Card>

        <Card compact className="relative p-[14px]">
          <IconButton
            label="How is this calculated?"
            icon={<QuestionMarkIcon className="size-3.5" />}
            onClick={() => setShowAvailableSheet(true)}
            className="absolute right-[10px] top-[10px] bg-transparent p-1 text-[var(--fin-muted)] hover:bg-[var(--fin-card2)] hover:text-[var(--fin-accent)]"
          />
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">Available</div>
          <div className="text-[15px] font-bold tracking-[-0.02em] text-[var(--fin-text)] break-all leading-tight">
            {fmt(availableBalance, currency)}
          </div>
        </Card>
      </div>

      {ACCOUNT_GROUPS.map(({ key, label, icon }) => {
        const accs = byType(key);
        if (!accs.length) return null;
        const isCollapsed = collapsedGroups.has(key);
        const groupedAccounts = groupAccountsByCurrency(accs);
        return (
          <div key={key}>
            <button
              onClick={() => toggleGroup(key)}
              className="mb-1 flex w-full cursor-pointer items-center justify-between"
            >
              <SectionLabel className="mb-0">
                {icon} {label}
              </SectionLabel>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tabular-nums text-[var(--fin-muted)]">
                  {groupedAccounts.map(([currency, accounts]) => {
                    const groupTotal = accounts.reduce((sum, acc) => sum + acc.balance, 0);
                    return (
                      <span key={currency} className="ml-2">
                        {fmt(groupTotal, currency)}
                      </span>
                    );
                  })}
                </span>
                <span
                  className={cn(
                    'text-[9px] text-[var(--fin-subtle)] transition-transform duration-200',
                    !isCollapsed && 'rotate-90',
                  )}
                >
                  ▶
                </span>
              </div>
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-2">
                {accs.map(acc => (
                  <AccountCard
                    key={acc.id}
                    acc={acc}
                    onSettle={handleSettle}
                    onClick={() => router.push(`/finances/accounts/${acc.id}`)}
                  />
                ))}
              </div>
            )}
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

      {showAvailableSheet && (
        <AvailableBalanceSheet
          accounts={activeAccounts}
          availableBalance={availableBalance}
          currency={currency}
          onToggle={handleToggleInclusion}
          onClose={() => setShowAvailableSheet(false)}
        />
      )}

      {showNetWorthSheet && (
        <NetWorthSheet
          accounts={activeAccounts}
          netWorth={netWorth}
          currency={currency}
          onClose={() => setShowNetWorthSheet(false)}
        />
      )}
    </div>
  );
}
