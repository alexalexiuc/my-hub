'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { T, Card } from './ui';

const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'MDL', 'RON', 'UAH'];

type CreateBudgetScreenProps = {
  onCreated: () => void;
};

export function CreateBudgetScreen({ onCreated }: CreateBudgetScreenProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/finances/budgets', {
        method: 'POST',
        body: { name: name.trim(), defaultCurrency: currency },
        silentToast: true,
      });
      onCreated();
    } catch {
      setError('Failed to create budget. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>₤</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Create your budget</div>
          <div style={{ fontSize: 13, color: T.muted }}>
            Give your budget a name and pick a default currency to get started.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: 'block', marginBottom: 6 }}>Budget name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Household, Personal…"
              style={{
                width: '100%',
                background: T.card2,
                border: `1px solid ${T.border}`,
                borderRadius: 7,
                padding: '9px 12px',
                fontSize: 13,
                color: T.text,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: T.muted, display: 'block', marginBottom: 6 }}>Default currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              style={{
                width: '100%',
                background: T.card2,
                border: `1px solid ${T.border}`,
                borderRadius: 7,
                padding: '9px 12px',
                fontSize: 13,
                color: T.text,
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {COMMON_CURRENCIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && <div style={{ fontSize: 12, color: T.red }}>{error}</div>}

          <button
            type="submit"
            disabled={!name.trim() || saving}
            style={{
              background: name.trim() && !saving ? T.accent : T.card3,
              color: name.trim() && !saving ? '#fff' : T.subtle,
              border: 'none',
              borderRadius: 8,
              padding: '11px',
              fontSize: 13,
              fontWeight: 600,
              cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
              transition: 'background .15s',
              marginTop: 4,
            }}
          >
            {saving ? 'Creating…' : 'Create budget'}
          </button>
        </form>
      </Card>
    </div>
  );
}
