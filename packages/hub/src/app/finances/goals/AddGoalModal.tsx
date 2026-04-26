'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { AccountTypes } from '@my-hub/shared/constants';

type AddGoalModalProps = {
  defaultCurrency: string;
  onClose: () => void;
  onCreated: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">{label}</label>
      {children}
    </div>
  );
}

const inputClassName =
  'w-full rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-2.5 py-[7px] text-[13px] text-[var(--fin-text)] outline-none';

export function AddGoalModal({ defaultCurrency, onClose, onCreated }: AddGoalModalProps) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await apiFetch('/api/finances/accounts', {
      method: 'POST',
      body: {
        name: name.trim(),
        type: AccountTypes.Goal,
        currency: defaultCurrency,
        openingBalance: parseFloat(openingBalance) || 0,
        details: { targetAmount: parseFloat(targetAmount) || 0 },
      },
    });
    setSaving(false);
    onCreated();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{
        background: 'var(--fin-overlay)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">New Goal</div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Goal Name">
            <input
              className={inputClassName}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Emergency Fund"
              autoFocus
              required
            />
          </Field>

          <Field label="Target Amount">
            <input
              className={inputClassName}
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              placeholder="10000"
            />
          </Field>

          <Field label="Current Savings">
            <input
              className={inputClassName}
              type="number"
              step="0.01"
              min="0"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              placeholder="0"
            />
          </Field>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] py-2 text-[13px] font-semibold text-[var(--fin-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={`flex-[2] rounded-lg border-none py-2 text-[13px] font-semibold ${
                saving
                  ? 'bg-[var(--fin-card2)] text-[var(--fin-muted)]'
                  : 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
              } ${!name.trim() ? 'opacity-50' : ''}`}
            >
              {saving ? 'Saving…' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
