'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { Card, SectionLabel } from '../ui';

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
  background: 'var(--fin-card2)',
  border: `1px solid ${'var(--fin-border)'}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--fin-text)',
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
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[14px]">
        {[80, 140, 100].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border"
            style={{ height: h, background: 'var(--fin-card)', borderColor: 'var(--fin-border)', opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  const isOwner = data.budget.createdByUserId !== undefined;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[18px]">
      <div className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fin-text)' }}>
        Budget Settings
      </div>

      {/* General */}
      <Card className="flex flex-col gap-[14px] p-[18px]">
        <SectionLabel style={{ marginBottom: 0 }}>General</SectionLabel>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--fin-subtle)' }}>
            Budget name
          </label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="My Budget" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--fin-subtle)' }}>
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
          className="self-start rounded-lg border-none px-[18px] py-2 text-[13px] font-semibold"
          style={{
            background: 'var(--fin-accent)',
            color: 'var(--fin-on-accent)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </Card>

      {/* Members */}
      <Card className="p-[18px]">
        <SectionLabel style={{ marginBottom: 12 }}>Members</SectionLabel>
        <div className="flex flex-col gap-2">
          {data.members.map(m => {
            const isCreator = m.userId === data.budget.createdByUserId;
            const isRemoving = removingUserId === m.userId;
            return (
              <div key={m.userId} className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{
                    background: 'var(--fin-accent-d)',
                    border: `1px solid ${'var(--fin-accent)'}44`,
                    color: 'var(--fin-accent)',
                  }}
                >
                  {(m.name ?? m.email)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium" style={{ color: 'var(--fin-text)' }}>
                    {m.name ?? m.email}
                  </div>
                  {m.name && (
                    <div className="text-[11px]" style={{ color: 'var(--fin-subtle)' }}>
                      {m.email}
                    </div>
                  )}
                </div>
                {isCreator && (
                  <span
                    className="rounded-[20px] px-2 py-[2px] text-[10px]"
                    style={{
                      color: 'var(--fin-accent)',
                      background: 'var(--fin-accent-d)',
                      border: `1px solid ${'var(--fin-accent)'}44`,
                    }}
                  >
                    Owner
                  </span>
                )}
                {!isCreator && isOwner && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    disabled={isRemoving}
                    className="rounded-md border bg-transparent px-2.5 py-1 text-[11px]"
                    style={{
                      border: `1px solid ${'var(--fin-border)'}`,
                      color: 'var(--fin-red)',
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
      <Card className="p-[18px]" style={{ border: `1px solid ${'var(--fin-red)'}33` }}>
        <SectionLabel style={{ marginBottom: 8, color: 'var(--fin-red)' }}>Danger zone</SectionLabel>
        <p className="mb-3 text-xs" style={{ color: 'var(--fin-muted)' }}>
          Permanently deletes this budget and all associated accounts, categories, and transactions. This cannot be
          undone.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="cursor-pointer rounded-lg px-4 py-2 text-[13px] font-semibold"
            style={{
              background: 'var(--fin-red-d)',
              border: `1px solid ${'var(--fin-red)'}44`,
              color: 'var(--fin-red)',
            }}
          >
            Delete budget…
          </button>
        ) : (
          <div
            className="flex flex-col gap-2.5 rounded-[10px] p-[14px]"
            style={{
              background: 'var(--fin-red-d)',
              border: `1px solid ${'var(--fin-red)'}44`,
            }}
          >
            <p className="text-[13px] font-medium" style={{ color: 'var(--fin-red)' }}>
              Are you sure? All data will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteBudget}
                disabled={deleting}
                className="rounded-lg border-none px-4 py-2 text-[13px] font-semibold"
                style={{
                  background: 'var(--fin-red)',
                  color: 'var(--fin-on-solid)',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border bg-transparent px-4 py-2 text-[13px]"
                style={{
                  border: `1px solid ${'var(--fin-border)'}`,
                  color: 'var(--fin-muted)',
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
