'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel, Bar, Sparkline } from '../ui';
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
    <Card onClick={onClick} style={{ padding: '12px 14px', cursor: 'pointer' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: hasExtra ? 10 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.muted, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{acc.name}</div>
            {acc.cardLastFour && <div style={{ fontSize: 10, color: T.subtle }}>•••• {acc.cardLastFour}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: isLiability ? T.red : T.text }}>
            {acc.type === 'loan' ? '-' : ''}
            {fmt(acc.balance, acc.currency)}
          </div>
          <div style={{ fontSize: 10, color: T.subtle }}>{acc.currency}</div>
        </div>
      </div>

      {acc.type === 'credit_card' && acc.creditLimit != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.muted }}>
              Used {fmt(acc.balance, acc.currency)} of {fmt(acc.creditLimit, acc.currency)}
            </span>
            <span style={{ fontSize: 10, color: T.muted }}>{Math.round((acc.balance / acc.creditLimit) * 100)}%</span>
          </div>
          <Bar value={acc.balance} max={acc.creditLimit} color={T.blue} height={4} />
        </div>
      )}

      {acc.type === 'goal' && acc.targetAmount != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.muted }}>
              {fmt(acc.balance, acc.currency)} of {fmt(acc.targetAmount, acc.currency)}
            </span>
            <span style={{ fontSize: 10, color: T.green }}>{Math.round((acc.balance / acc.targetAmount) * 100)}%</span>
          </div>
          <Bar value={acc.balance} max={acc.targetAmount} color={T.green} height={4} />
        </div>
      )}

      {acc.type === 'investment' && acc.deposited != null && (
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: T.subtle }}>Deposited</div>
            <div style={{ fontSize: 12, color: T.muted }}>{fmt(acc.deposited, acc.currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.subtle }}>P&L</div>
            <div style={{ fontSize: 12, color: acc.balance >= acc.deposited ? T.green : T.red }}>
              {acc.balance >= acc.deposited ? '+' : '-'}
              {fmt(Math.abs(acc.balance - acc.deposited), acc.currency)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.subtle }}>Return</div>
            <div style={{ fontSize: 12, color: acc.balance >= acc.deposited ? T.green : T.red }}>
              {acc.deposited > 0
                ? `${acc.balance >= acc.deposited ? '+' : ''}${(((acc.balance - acc.deposited) / acc.deposited) * 100).toFixed(1)}%`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {acc.type === 'tracking' && (
        <div style={{ fontSize: 10, color: T.subtle }}>Manually tracked value · read-only</div>
      )}

      {acc.type === 'borrowed_lent' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Direction
              </div>
              <div style={{ fontSize: 12, color: acc.direction === 'gave' ? T.green : T.amber, fontWeight: 600 }}>
                {acc.direction === 'gave' ? 'Lent' : 'Borrowed'}
              </div>
            </div>
            {acc.counterpartyName && (
              <div>
                <div style={{ fontSize: 9, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  With
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>{acc.counterpartyName}</div>
              </div>
            )}
            {acc.dueDate && (
              <div>
                <div style={{ fontSize: 9, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Due
                </div>
                <div style={{ fontSize: 12, color: T.amber }}>{acc.dueDate}</div>
              </div>
            )}
            {acc.settled && <div style={{ fontSize: 11, color: T.green, alignSelf: 'center' }}>✓ Settled</div>}
          </div>
          {!acc.settled && (
            <button
              onClick={e => {
                e.stopPropagation();
                onSettle(acc.id);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: T.tealD,
                border: `1px solid ${T.teal}44`,
                color: T.teal,
                cursor: 'pointer',
              }}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[80, 120, 100].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { currency, netWorth, netWorthHistory, accounts } = data;
  const byType = (type: string) => accounts.filter(a => a.type === type);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Accounts</div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: 11,
            background: T.card2,
            border: `1px solid ${T.border}`,
            color: T.muted,
            cursor: 'pointer',
          }}
        >
          + New Account
        </button>
      </div>

      {/* Net worth summary */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.accent}18, ${T.violet}18)`,
          border: `1px solid ${T.accent}33`,
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Total Net Worth</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>
            {fmt(netWorth, currency)}
          </div>
        </div>
        <Sparkline data={netWorthHistory} color={T.green} width={80} height={40} />
      </div>

      {ACCOUNT_GROUPS.map(({ key, label, icon }) => {
        const accs = byType(key);
        if (!accs.length) return null;
        return (
          <div key={key}>
            <SectionLabel>
              {icon} {label}
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.subtle, fontSize: 13 }}>
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
