'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { TransactionModal } from './transactions/TransactionModal';
import type { BudgetDetailResponse } from '@/app/api/finances/budget/route';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  dividerBefore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈', path: '/finances' },
  { id: 'accounts', label: 'Accounts', icon: '⊞', path: '/finances/accounts' },
  { id: 'transactions', label: 'Transactions', icon: '↕', path: '/finances/transactions' },
  { id: 'categories', label: 'Categories', icon: '⬡', path: '/finances/categories' },
  { id: 'goals', label: 'Goals', icon: '◎', path: '/finances/goals' },
  { id: 'budget', label: 'Budget', icon: '', path: '/finances/budget', dividerBefore: true },
  { id: 'cashflow', label: 'Cashflow', icon: '', path: '/finances/cashflow' },
  { id: 'payees', label: 'Payees', icon: '', path: '/finances/payees' },
  { id: 'networth', label: 'Net Worth', icon: '', path: '/finances/networth' },
  { id: 'monthly-plan', label: 'Monthly Plan', icon: '⊟', path: '/finances/monthly-plan', dividerBefore: true },
  { id: 'settings', label: 'Settings', icon: '⚙', path: '/finances/settings', dividerBefore: true },
];

export function FinancesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
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

  const isActive = (path: string) => (path === '/finances' ? pathname === '/finances' : pathname.startsWith(path));

  return (
    <div className="flex w-[200px] shrink-0 flex-col px-2.5 py-4 bg-[var(--fin-card)] border-r border-[var(--fin-border)]">
      <div className="mb-3 border-b border-[var(--fin-border)] px-2 pb-4 pt-1">
        <div
          data-testid="sidebar-budget-name"
          className="text-base font-bold tracking-[-0.02em] text-[var(--fin-text)]"
        >
          {currency && <span className="text-[var(--fin-accent)]">{currency} </span>}
          {budgetName ?? 'Finances'}
        </div>
      </div>

      {NAV_ITEMS.map(({ id, label, icon, path, dividerBefore }) => {
        const active = isActive(path);
        return (
          <div key={id}>
            {dividerBefore && <div className="mx-1 my-1.5 h-px bg-[var(--fin-border)]" />}
            <button
              onClick={() => router.push(path)}
              className={cn(
                'mb-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 py-[9px] text-left text-[13px]',
                active
                  ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)] font-semibold'
                  : 'bg-transparent text-[var(--fin-muted)]',
              )}
              style={{ border: active ? `1px solid var(--fin-accent)44` : '1px solid transparent' }}
            >
              {icon && <span className="text-[15px] leading-none">{icon}</span>}
              {label}
            </button>
          </div>
        );
      })}

      <div className="flex-1" />

      {showAddTx && (
        <TransactionModal onCloseAction={() => setShowAddTx(false)} onSavedAction={() => setShowAddTx(false)} />
      )}
      <button
        onClick={() => setShowAddTx(true)}
        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none p-2.5 text-[13px] font-semibold bg-[var(--fin-accent)] text-[var(--fin-on-solid)]"
      >
        <span className="text-base">+</span> Add Transaction
      </button>
    </div>
  );
}
