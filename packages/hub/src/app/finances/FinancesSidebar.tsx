'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { AddTransactionModal } from './transactions/AddTransactionModal';

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
  { id: 'settings', label: 'Settings', icon: '⚙', path: '/finances/settings', dividerBefore: true },
];

export function FinancesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAddTx, setShowAddTx] = useState(false);
  const [budgetName, setBudgetName] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ budget: { name: string; defaultCurrency: string } }>('/api/finances/budget', { silentToast: true })
      .then(res => {
        setBudgetName(res.budget.name);
        setCurrency(res.budget.defaultCurrency);
      })
      .catch(() => {});
  }, []);

  const isActive = (path: string) => (path === '/finances' ? pathname === '/finances' : pathname.startsWith(path));

  return (
    <div
      className="flex w-[200px] shrink-0 flex-col px-2.5 py-4"
      style={{ background: 'var(--fin-card)', borderRight: `1px solid ${'var(--fin-border)'}` }}
    >
      <div className="mb-3 border-b px-2 pb-4 pt-1" style={{ borderColor: 'var(--fin-border)' }}>
        <div className="text-base font-bold tracking-[-0.02em]" style={{ color: 'var(--fin-text)' }}>
          {currency && <span style={{ color: 'var(--fin-accent)' }}>{currency} </span>}
          {budgetName ?? 'Finances'}
        </div>
      </div>

      {NAV_ITEMS.map(({ id, label, icon, path, dividerBefore }) => {
        const active = isActive(path);
        return (
          <div key={id}>
            {dividerBefore && <div className="mx-1 my-1.5 h-px" style={{ background: 'var(--fin-border)' }} />}
            <button
              onClick={() => router.push(path)}
              className="mb-0.5 flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[9px] text-left text-[13px]"
              style={{
                background: active ? 'var(--fin-accent-d)' : 'transparent',
                border: active ? `1px solid ${'var(--fin-accent)'}44` : '1px solid transparent',
                color: active ? 'var(--fin-accent)' : 'var(--fin-muted)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {icon && <span className="text-[15px] leading-none">{icon}</span>}
              {label}
            </button>
          </div>
        );
      })}

      <div className="flex-1" />

      {showAddTx && <AddTransactionModal onClose={() => setShowAddTx(false)} onCreated={() => setShowAddTx(false)} />}
      <button
        onClick={() => setShowAddTx(true)}
        className="flex items-center justify-center gap-1.5 rounded-lg border-none p-2.5 text-[13px] font-semibold"
        style={{
          background: 'var(--fin-accent)',
          color: 'var(--fin-on-solid)',
          cursor: 'pointer',
        }}
      >
        <span className="text-base">+</span> Add Transaction
      </button>
    </div>
  );
}
