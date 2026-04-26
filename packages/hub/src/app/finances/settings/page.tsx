'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, Card, SectionLabel } from '../ui';

interface Member {
  userId: string;
  email: string;
  name: string | null;
  joinedAt: string;
}

interface BudgetSettings {
  budget: { id: number; name: string; defaultCurrency: string; createdByUserId: string };
  members: Member[];
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'MDL', 'RON', 'CHF', 'JPY', 'CAD', 'AUD'];

const inputStyle: React.CSSProperties = {
  background: T.card2,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: T.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export default function FinancesSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<BudgetSettings | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<BudgetSettings>('/api/finances/budget', { silentToast: true });
    setData(result);
    setName(result.budget.name);
    setCurrency(result.budget.defaultCurrency);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      await apiFetch('/api/finances/budget', {
        method: 'PATCH',
        body: { name, defaultCurrency: currency },
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBudget() {
    setDeleting(true);
    try {
      await apiFetch('/api/finances/budget', { method: 'DELETE', body: {} });
      router.push('/finances');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingUserId(userId);
    try {
      await apiFetch('/api/finances/budget', {
        method: 'DELETE',
        body: { removeMemberUserId: userId },
        silentToast: true,
      });
      await load();
    } finally {
      setRemovingUserId(null);
    }
  }

  if (!data) {
    return (
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560, margin: '0 auto', width: '100%' }}
      >
        {[80, 140, 100].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  const isOwner = data.budget.createdByUserId !== undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 560, margin: '0 auto', width: '100%' }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Budget Settings</div>

      {/* General */}
      <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SectionLabel style={{ marginBottom: 0 }}>General</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Budget name
          </label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="My Budget" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Default currency
          </label>
          <select style={inputStyle} value={currency} onChange={e => setCurrency(e.target.value)}>
            {CURRENCIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          style={{
            alignSelf: 'flex-start',
            background: T.accent,
            border: 'none',
            borderRadius: 8,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            color: '#0e0e12',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </Card>

      {/* Members */}
      <Card style={{ padding: 18 }}>
        <SectionLabel style={{ marginBottom: 12 }}>Members</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.members.map(m => {
            const isCreator = m.userId === data.budget.createdByUserId;
            const isRemoving = removingUserId === m.userId;
            return (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: T.accentD,
                    border: `1px solid ${T.accent}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    color: T.accent,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {(m.name ?? m.email)[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{m.name ?? m.email}</div>
                  {m.name && <div style={{ fontSize: 11, color: T.subtle }}>{m.email}</div>}
                </div>
                {isCreator && (
                  <span
                    style={{
                      fontSize: 10,
                      color: T.accent,
                      background: T.accentD,
                      padding: '2px 8px',
                      borderRadius: 20,
                      border: `1px solid ${T.accent}44`,
                    }}
                  >
                    Owner
                  </span>
                )}
                {!isCreator && isOwner && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    disabled={isRemoving}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11,
                      color: T.red,
                      cursor: isRemoving ? 'not-allowed' : 'pointer',
                      opacity: isRemoving ? 0.5 : 1,
                    }}
                  >
                    {isRemoving ? '…' : 'Remove'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Danger zone */}
      <Card style={{ padding: 18, border: `1px solid ${T.red}33` }}>
        <SectionLabel style={{ marginBottom: 8, color: T.red }}>Danger zone</SectionLabel>
        <p style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
          Permanently deletes this budget and all associated accounts, categories, and transactions. This cannot be
          undone.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              background: T.redD,
              border: `1px solid ${T.red}44`,
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              color: T.red,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Delete budget…
          </button>
        ) : (
          <div
            style={{
              background: T.redD,
              border: `1px solid ${T.red}44`,
              borderRadius: 10,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p style={{ fontSize: 13, color: T.red, fontWeight: 500 }}>
              Are you sure? All data will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteBudget}
                disabled={deleting}
                style={{
                  background: T.red,
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  color: T.muted,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
