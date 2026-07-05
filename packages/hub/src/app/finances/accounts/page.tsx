'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn, apiFetch } from '@/lib/utils';
import { fmt, AddButton, TYPE_META } from '../ui';
import { Card, Collapsible, Divider, IconButton, SectionLabel, Sparkline, SubText } from '@/components';
import { QuestionMarkIcon } from '@/components/icons';
import { AccountModal } from './AccountModal';
import { AccountProgressBar } from './AccountProgressBar';
import { BorrowedLentDetails } from './BorrowedLentDetails';
import { AccountsPageSkeleton } from './AccountsPageSkeleton';
import { AvailableBalanceSheet } from './AvailableBalanceSheet';
import { NetWorthSheet } from './NetWorthSheet';
import type { AccountItem, AccountsListData } from '@/app/api/finances/accounts/route';
import { LIABILITY_ACCOUNT_TYPES } from '@my-hub/shared/constants';
import type { AccountType } from '@my-hub/shared/constants';
import { formatCardLastFour } from '@my-hub/shared/utils';
import { ACCOUNT_GROUPS, groupAccountsByCurrency } from './accounts.utils';

function amountColor(balance: number, type: AccountType): string {
  if (LIABILITY_ACCOUNT_TYPES.has(type)) return 'text-[var(--red)]';
  if (balance > 0) return 'text-[var(--green)]';
  if (balance < 0) return 'text-[var(--red)]';
  return 'text-[var(--text)]';
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
    <div onClick={onClick} className="cursor-pointer px-[14px] py-2">
      <div className={cn('flex items-center justify-between', hasExtra ? 'mb-[10px]' : 'mb-0')}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--muted)]" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text)] truncate">{acc.name}</div>
            {acc.cardLastFour && <SubText className="block">{formatCardLastFour(acc.cardLastFour)}</SubText>}
            {(acc.monthIncome != null || acc.monthExpenses != null) && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] tabular-nums">
                <span className="text-[var(--green)]">+{fmt(acc.monthIncome ?? 0, acc.currency)}</span>
                <span className="text-[var(--red)]">-{fmt(acc.monthExpenses ?? 0, acc.currency)}</span>
              </div>
            )}
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
          color="var(--blue)"
          prefix="Used"
        />
      )}

      {acc.type === 'goal' && acc.targetAmount != null && (
        <AccountProgressBar value={acc.balance} max={acc.targetAmount} currency={acc.currency} color="var(--green)" />
      )}

      {acc.type === 'tracking' && <SubText className="block">Manually tracked value · read-only</SubText>}

      {acc.type === 'borrowed_lent' && <BorrowedLentDetails acc={acc} onSettle={onSettle} />}
    </div>
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
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Accounts</div>
        <AddButton onClick={() => setShowAddModal(true)} title="Add account" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card compact className="relative p-[14px]">
          <IconButton
            variant="ghost"
            label="What is net worth?"
            icon={<QuestionMarkIcon className="size-3.5" />}
            onClick={() => setShowNetWorthSheet(true)}
            className="absolute right-[10px] top-[10px] p-1 text-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--accent)]"
          />
          <SubText className="block mb-1.5 uppercase tracking-[0.08em]">Net Worth</SubText>
          <div className="mb-2 text-[15px] font-bold tracking-[-0.02em] text-[var(--text)] break-all leading-tight">
            {fmt(netWorth, currency)}
          </div>
          <Sparkline data={netWorthHistory} color="var(--green)" width={80} height={28} />
        </Card>

        <Card compact className="relative p-[14px]">
          <IconButton
            label="How is this calculated?"
            icon={<QuestionMarkIcon className="size-3.5" />}
            onClick={() => setShowAvailableSheet(true)}
            variant="ghost"
            className="absolute right-[10px] top-[10px] p-1 text-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--accent)]"
          />
          <SubText className="block mb-1.5 uppercase tracking-[0.08em]">Available</SubText>
          <div className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text)] break-all leading-tight">
            {fmt(availableBalance, currency)}
          </div>
        </Card>
      </div>

      {ACCOUNT_GROUPS.map(({ key, label }) => {
        const icon = TYPE_META[key]?.icon ?? '';
        const accs = byType(key);
        if (!accs.length) return null;
        const isCollapsed = collapsedGroups.has(key);
        const groupedAccounts = groupAccountsByCurrency(accs);
        return (
          <Collapsible
            key={key}
            variant="text"
            label={
              <SectionLabel className="mb-0">
                {icon} {label}
              </SectionLabel>
            }
            open={!isCollapsed}
            onOpenChange={() => toggleGroup(key)}
            actions={
              <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                {groupedAccounts.map(([currency, accounts]) => {
                  const groupTotal = accounts.reduce((sum, acc) => sum + acc.balance, 0);
                  return (
                    <span key={currency} className="ml-2">
                      {fmt(groupTotal, currency)}
                    </span>
                  );
                })}
              </span>
            }
          >
            <Card className="p-0">
              {accs.map((acc, i) => (
                <div key={acc.id}>
                  {i > 0 && <Divider />}
                  <AccountCard
                    acc={acc}
                    onSettle={handleSettle}
                    onClick={() => router.push(`/finances/accounts/${acc.id}`)}
                  />
                </div>
              ))}
            </Card>
          </Collapsible>
        );
      })}

      {activeAccounts.length === 0 && archivedAccounts.length === 0 && (
        <div className="py-12 text-center text-[13px] text-[var(--subtle)]">
          No accounts yet. Add your first account to get started.
        </div>
      )}

      {archivedAccounts.length > 0 && (
        <Collapsible
          variant="text"
          label={<SectionLabel className="mb-0">🗄 Archived ({archivedAccounts.length})</SectionLabel>}
          open={showArchived}
          onOpenChange={() => setShowArchived(v => !v)}
        >
          <Card className="p-0">
            {archivedAccounts.map((acc, i) => (
              <div key={acc.id}>
                {i > 0 && <Divider />}
                <AccountCard
                  acc={acc}
                  onSettle={handleSettle}
                  onClick={() => router.push(`/finances/accounts/${acc.id}`)}
                />
              </div>
            ))}
          </Card>
        </Collapsible>
      )}

      {showAddModal && (
        <AccountModal
          defaultCurrency={currency}
          onClose={() => setShowAddModal(false)}
          onDone={() => {
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
