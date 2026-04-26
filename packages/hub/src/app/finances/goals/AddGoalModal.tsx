'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { T } from '../ui';
import { AccountTypes } from '@my-hub/shared/constants';

type AddGoalModalProps = {
  defaultCurrency: string;
  onClose: () => void;
  onCreated: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: T.card2,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 13,
  color: T.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 20,
          width: '100%',
          maxWidth: 420,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>New Goal</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Goal Name">
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Emergency Fund"
              autoFocus
              required
            />
          </Field>

          <Field label="Target Amount">
            <input
              style={inputStyle}
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
              style={inputStyle}
              type="number"
              step="0.01"
              min="0"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              placeholder="0"
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: T.card2,
                border: `1px solid ${T.border}`,
                color: T.muted,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              style={{
                flex: 2,
                padding: '8px 0',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: saving ? T.card2 : T.accent,
                border: 'none',
                color: saving ? T.muted : '#0e0e12',
                cursor: saving ? 'default' : 'pointer',
                opacity: !name.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
