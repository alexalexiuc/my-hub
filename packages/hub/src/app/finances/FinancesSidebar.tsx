'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { Sidebar, Button } from '@/components';
import type { SidebarNavItem } from '@/components';
import { TransactionModal } from './transactions/TransactionModal';
import type { BudgetDetailResponse } from '@/app/api/finances/budget/route';

const NAV_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈', path: '/finances', exact: true },
  { id: 'accounts', label: 'Accounts', icon: '⊞', path: '/finances/accounts' },
  { id: 'transactions', label: 'Transactions', icon: '↕', path: '/finances/transactions' },
  { id: 'categories', label: 'Categories', icon: '⬡', path: '/finances/categories' },
  { id: 'goals', label: 'Goals', icon: '◎', path: '/finances/goals' },
  { id: 'reporting', label: 'Reporting', icon: '◫', path: '/finances/reporting', dividerBefore: true },
  { id: 'budget', label: 'Budget', icon: '', path: '/finances/budget' },
  { id: 'cashflow', label: 'Cashflow', icon: '', path: '/finances/cashflow' },
  { id: 'payees', label: 'Payees', icon: '', path: '/finances/payees' },
  { id: 'networth', label: 'Net Worth', icon: '', path: '/finances/networth' },
  { id: 'monthly-plan', label: 'Monthly Plan', icon: '⊟', path: '/finances/monthly-plan', dividerBefore: true },
  { id: 'settings', label: 'Settings', icon: '⚙', path: '/finances/settings', dividerBefore: true },
];

export function FinancesSidebar() {
  const [showAddTx, setShowAddTx] = useState(false);
  const [budgetName, setBudgetName] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [hasBudget, setHasBudget] = useState<boolean | null>(null);

  const fetchBudget = useCallback(() => {
    apiFetch<BudgetDetailResponse>('/api/finances/budget', { silentToast: true })
      .then(res => {
        setBudgetName(res.budget.name);
        setCurrency(res.budget.defaultCurrency);
        setHasBudget(true);
      })
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
        <TransactionModal onCloseAction={() => setShowAddTx(false)} onSavedAction={() => setShowAddTx(false)} />
      )}
      <Sidebar
        items={NAV_ITEMS}
        header={
          <div data-testid="sidebar-budget-name" className="text-base font-bold tracking-[-0.02em] text-[var(--text)]">
            {currency && <span className="text-[var(--accent)]">{currency} </span>}
            {budgetName ?? 'Finances'}
          </div>
        }
        action={
          <Button onClick={() => setShowAddTx(true)} variant="accent" className="w-full">
            Add Transaction
          </Button>
        }
      />
    </>
  );
}
