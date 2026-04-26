'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { T } from './ui';
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

  const isActive = (path: string) => (path === '/finances' ? pathname === '/finances' : pathname.startsWith(path));

  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        background: T.card,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 10px',
      }}
    >
      <div
        style={{
          padding: '4px 8px 16px',
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, color: T.subtle, marginBottom: 2 }}>My Hub</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-.02em' }}>
          <span style={{ color: T.accent }}>₤</span> Finances
        </div>
      </div>

      {NAV_ITEMS.map(({ id, label, icon, path, dividerBefore }) => {
        const active = isActive(path);
        return (
          <div key={id}>
            {dividerBefore && <div style={{ height: 1, background: T.border, margin: '6px 4px' }} />}
            <button
              onClick={() => router.push(path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 7,
                marginBottom: 2,
                width: '100%',
                textAlign: 'left',
                background: active ? T.accentD : 'transparent',
                border: active ? `1px solid ${T.accent}44` : '1px solid transparent',
                color: active ? T.accent : T.muted,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {icon && <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>}
              {label}
            </button>
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      {showAddTx && <AddTransactionModal onClose={() => setShowAddTx(false)} onCreated={() => setShowAddTx(false)} />}
      <button
        onClick={() => setShowAddTx(true)}
        style={{
          background: T.accent,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 16 }}>+</span> Add Transaction
      </button>
    </div>
  );
}
