'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/utils';
import { DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { MEAL_LABELS } from './menu.utils';

interface Meal {
  id: number;
  menuId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  description: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface Props {
  meal: Meal;
  menuId: string;
  dayOfWeek: DayOfWeek;
  dayDate: string;
  onClose: () => void;
  onSwapped: (updated: Meal) => void;
}

export function SwapMealModal({ meal, menuId, dayOfWeek, onClose, onSwapped }: Props) {
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portalRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    portalRef.current = document.body;
    setMounted(true);
  }, []);

  const dayLabel = DAY_LABELS[dayOfWeek];
  const mealLabel = MEAL_LABELS[meal.mealType];

  async function handleSave() {
    const trimmed = description.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<{ meal: Meal }>(`/api/calories/menu/${menuId}`, {
        method: 'PATCH',
        body: {
          dayOfWeek,
          mealType: meal.mealType,
          description: trimmed,
        },
      });
      onSwapped(data.meal);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !portalRef.current) return null;

  return createPortal(
    <div
      className="calories-theme fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--shell)] flex flex-col gap-4 p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Edit meal</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {dayLabel} · {mealLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none">
            ×
          </button>
        </div>

        {/* Current meal */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-1">Current</p>
          <p className="text-sm text-[var(--subtle)]">{meal.description}</p>
          {meal.kcal != null && <p className="text-[10px] text-[var(--subtle)] mt-0.5">{meal.kcal} kcal</p>}
        </div>

        {/* New meal input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text)]">New meal</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={`e.g. Grilled sea bass with roasted vegetables`}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--accent)]/60 resize-none"
          />
          <p className="text-[10px] text-[var(--subtle)]">
            Or ask Claude:{' '}
            <span className="italic">
              "Change my {dayLabel} {mealLabel.toLowerCase()} to something different"
            </span>{' '}
            — Claude will update it automatically.
          </p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || saving}
            className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    portalRef.current,
  );
}
