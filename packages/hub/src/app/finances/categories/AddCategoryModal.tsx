'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { CategoryIcons } from '@my-hub/shared/constants';
import type { CategoryIcon } from '@my-hub/shared/constants';

type GroupOption = { id: number; name: string };

type AddCategoryModalProps = {
  groups: GroupOption[];
  defaultGroupId?: number | null;
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

const PRESET_COLORS = [
  '#6ee7b7',
  '#93c5fd',
  '#a78bfa',
  '#fcd34d',
  '#f87171',
  '#2dd4bf',
  '#fb923c',
  '#e879f9',
  '#34d399',
  '#60a5fa',
];

const ICON_OPTIONS: { value: CategoryIcon; emoji: string; label: string }[] = [
  { value: CategoryIcons.ShoppingCart, emoji: '🛒', label: 'Groceries' },
  { value: CategoryIcons.UtensilsCrossed, emoji: '🍽', label: 'Dining' },
  { value: CategoryIcons.Coffee, emoji: '☕', label: 'Coffee' },
  { value: CategoryIcons.Car, emoji: '🚗', label: 'Car' },
  { value: CategoryIcons.Bus, emoji: '🚌', label: 'Transit' },
  { value: CategoryIcons.Plane, emoji: '✈️', label: 'Travel' },
  { value: CategoryIcons.Motorbike, emoji: '🏍', label: 'Motorbike' },
  { value: CategoryIcons.Home, emoji: '🏠', label: 'Home' },
  { value: CategoryIcons.Zap, emoji: '⚡', label: 'Utilities' },
  { value: CategoryIcons.Wifi, emoji: '📶', label: 'Internet' },
  { value: CategoryIcons.Heart, emoji: '❤️', label: 'Health' },
  { value: CategoryIcons.Pill, emoji: '💊', label: 'Pharmacy' },
  { value: CategoryIcons.Tv, emoji: '📺', label: 'TV' },
  { value: CategoryIcons.Music, emoji: '🎵', label: 'Music' },
  { value: CategoryIcons.Gamepad2, emoji: '🎮', label: 'Gaming' },
  { value: CategoryIcons.Banknote, emoji: '💵', label: 'Cash' },
  { value: CategoryIcons.TrendingUp, emoji: '📈', label: 'Invest' },
  { value: CategoryIcons.CreditCard, emoji: '💳', label: 'Card' },
  { value: CategoryIcons.ShoppingBag, emoji: '🛍', label: 'Shopping' },
  { value: CategoryIcons.Gift, emoji: '🎁', label: 'Gifts' },
  { value: CategoryIcons.BookOpen, emoji: '📖', label: 'Education' },
  { value: CategoryIcons.Briefcase, emoji: '💼', label: 'Work' },
  { value: CategoryIcons.Tag, emoji: '🏷', label: 'Other' },
  { value: CategoryIcons.MoreHorizontal, emoji: '•••', label: 'Misc' },
];

export function AddCategoryModal({ groups, defaultGroupId, onClose, onCreated }: AddCategoryModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<CategoryIcon | null>(null);
  const [color, setColor] = useState(PRESET_COLORS[0]!);
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [groupId, setGroupId] = useState<string>(defaultGroupId != null ? String(defaultGroupId) : '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !icon) return;
    setSaving(true);
    await apiFetch('/api/finances/categories', {
      method: 'POST',
      body: {
        name: name.trim(),
        icon: icon ?? null,
        color,
        monthlyTarget: monthlyTarget ? parseFloat(monthlyTarget) : null,
        groupId: groupId ? parseInt(groupId) : null,
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
        className="max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">New Category</div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <input
              className={inputClassName}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Groceries"
              autoFocus
              required
            />
          </Field>

          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(icon === opt.value ? null : opt.value)}
                  title={opt.label}
                  className="min-w-9 cursor-pointer rounded-md px-[7px] py-1 text-sm"
                  style={{
                    background: icon === opt.value ? 'var(--fin-accent-d)' : 'var(--fin-card2)',
                    border: `1px solid ${icon === opt.value ? 'var(--fin-accent)' + '44' : 'var(--fin-border)'}`,
                  }}
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Color">
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-6 w-6 shrink-0 cursor-pointer rounded-full"
                  style={{
                    background: c,
                    border: color === c ? '2px solid var(--fin-text)' : '2px solid transparent',
                  }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded-full border-none bg-transparent"
                title="Custom color"
              />
            </div>
          </Field>

          <Field label="Monthly Target (optional)">
            <input
              className={inputClassName}
              type="number"
              step="0.01"
              min="0"
              value={monthlyTarget}
              onChange={e => setMonthlyTarget(e.target.value)}
              placeholder="e.g. 500"
            />
          </Field>

          <Field label="Group (optional)">
            <select className={inputClassName} value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">— None —</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
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
              disabled={saving || !name.trim() || !icon}
              className={`rounded-lg border-none px-4 py-[7px] text-[13px] font-semibold ${
                saving || !name.trim() || !icon
                  ? 'cursor-not-allowed bg-[var(--fin-card2)] text-[var(--fin-muted)] opacity-50'
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
