'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { BottomNav } from '@/components';
import type { BottomNavItem } from '@/components';
import { TransactionModal } from './transactions/TransactionModal';
import { transactionEvents } from './transactions/transactionEvents';
import type { BudgetDetailResponse } from '@/app/api/finances/budget/route';

const LEFT_ITEMS: BottomNavItem[] = [
  { id: 'dashboard', icon: '◈', label: 'Home', path: '/finances', exact: true },
  { id: 'accounts', icon: '⊞', label: 'Accounts', path: '/finances/accounts' },
];

const RIGHT_ITEMS: BottomNavItem[] = [
  { id: 'categories', icon: '⬡', label: 'Categories', path: '/finances/categories' },
];

const MORE_ITEMS: BottomNavItem[] = [
  { id: 'transactions', icon: '↕', label: 'Transactions', path: '/finances/transactions' },
  { id: 'reporting', icon: '◫', label: 'Reporting', path: '/finances/reporting' },
  { id: 'goals', icon: '◎', label: 'Goals', path: '/finances/goals' },
  { id: 'monthly-plan', icon: '⊟', label: 'Monthly Plan', path: '/finances/monthly-plan' },
  { id: 'budget', icon: '▦', label: 'Budget', path: '/finances/budget' },
  { id: 'cashflow', icon: '⟳', label: 'Cashflow', path: '/finances/cashflow' },
  { id: 'payees', icon: '◉', label: 'Payees', path: '/finances/payees' },
  { id: 'networth', icon: '▲', label: 'Net Worth', path: '/finances/networth' },
  { id: 'portfolio', icon: '◍', label: 'Portfolio', path: '/finances/portfolio' },
  { id: 'settings', icon: '⚙', label: 'Settings', path: '/finances/settings' },
];

type FinancesBottomNavProps = {
  className?: string;
};

export function FinancesBottomNav({ className }: FinancesBottomNavProps) {
  const [showAddTx, setShowAddTx] = useState(false);
  const [hasBudget, setHasBudget] = useState<boolean | null>(null);

  const fetchBudget = useCallback(() => {
    apiFetch<BudgetDetailResponse>('/api/finances/budget', { silentToast: true })
      .then(() => setHasBudget(true))
      .catch(() => setHasBudget(false));
  }, []);

  useEffect(() => {
    fetchBudget();
    window.addEventListener('finances:budget-changed', fetchBudget);
    return () => window.removeEventListener('finances:budget-changed', fetchBudget);
  }, [fetchBudget]);

  if (hasBudget === false) return null;

  return (
    <>
      {showAddTx && (
        <TransactionModal
          onCloseAction={() => setShowAddTx(false)}
          onSavedAction={() => {
            setShowAddTx(false);
            transactionEvents.emit('changed');
          }}
        />
      )}
      <BottomNav
        leftItems={LEFT_ITEMS}
        rightItems={RIGHT_ITEMS}
        moreItems={MORE_ITEMS}
        fab={{ label: 'Add', onClick: () => setShowAddTx(true) }}
        className={className}
      />
    </>
  );
}
