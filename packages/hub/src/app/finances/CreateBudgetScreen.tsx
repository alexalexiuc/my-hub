'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card } from './ui';

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
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-[380px] p-7">
        <div className="mb-6 text-center">
          <div className="mb-2.5 text-[32px]">₤</div>
          <div className="mb-1.5 text-lg font-bold" style={{ color: 'var(--fin-text)' }}>
            Create your budget
          </div>
          <div className="text-[13px]" style={{ color: 'var(--fin-muted)' }}>
            Give your budget a name and pick a default currency to get started.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
          <div>
            <label className="mb-1.5 block text-[11px]" style={{ color: 'var(--fin-muted)' }}>
              Budget name
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Household, Personal…"
              className="w-full rounded-[7px] border px-3 py-[9px] text-[13px] outline-none"
              style={{
                background: 'var(--fin-card2)',
                borderColor: 'var(--fin-border)',
                color: 'var(--fin-text)',
              }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px]" style={{ color: 'var(--fin-muted)' }}>
              Default currency
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full cursor-pointer rounded-[7px] border px-3 py-[9px] text-[13px] outline-none"
              style={{
                background: 'var(--fin-card2)',
                borderColor: 'var(--fin-border)',
                color: 'var(--fin-text)',
              }}
            >
              {COMMON_CURRENCIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-xs" style={{ color: 'var(--fin-red)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="mt-1 rounded-lg border-none py-[11px] text-[13px] font-semibold transition-colors"
            style={{
              background: name.trim() && !saving ? 'var(--fin-accent)' : 'var(--fin-card3)',
              color: name.trim() && !saving ? 'var(--fin-on-solid)' : 'var(--fin-subtle)',
              cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Creating…' : 'Create budget'}
          </button>
        </form>
      </Card>
    </div>
  );
}
