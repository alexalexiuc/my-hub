'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';

type AddGroupModalProps = {
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

export function AddGroupModal({ onClose, onCreated }: AddGroupModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await apiFetch('/api/finances/groups', {
      method: 'POST',
      body: { name: name.trim() },
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
        className="w-full max-w-[360px] rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">New Group</div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <input
              className={inputClassName}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Living Expenses"
              autoFocus
              required
            />
          </Field>

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--fin-border)] bg-transparent px-4 py-[7px] text-[13px] text-[var(--fin-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={`rounded-lg border-none px-4 py-[7px] text-[13px] font-semibold ${
                saving
                  ? 'bg-[var(--fin-card2)] text-[var(--fin-muted)] opacity-70'
                  : 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
              }`}
            >
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
