'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { T } from '../ui';
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
    if (!name.trim()) return;
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
          maxWidth: 400,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>New Category</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Name">
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Groceries"
              autoFocus
              required
            />
          </Field>

          <Field label="Icon">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(icon === opt.value ? null : opt.value)}
                  title={opt.label}
                  style={{
                    background: icon === opt.value ? T.accentD : T.card2,
                    border: `1px solid ${icon === opt.value ? T.accent + '44' : T.border}`,
                    borderRadius: 6,
                    padding: '4px 7px',
                    fontSize: 14,
                    cursor: 'pointer',
                    minWidth: 36,
                  }}
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Color">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? `2px solid ${T.text}` : `2px solid transparent`,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                }}
                title="Custom color"
              />
            </div>
          </Field>

          <Field label="Monthly Target (optional)">
            <input
              style={inputStyle}
              type="number"
              step="0.01"
              min="0"
              value={monthlyTarget}
              onChange={e => setMonthlyTarget(e.target.value)}
              placeholder="e.g. 500"
            />
          </Field>

          <Field label="Group (optional)">
            <select style={inputStyle} value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">— None —</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 13,
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
                background: T.accent,
                border: 'none',
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#0e0e12',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
