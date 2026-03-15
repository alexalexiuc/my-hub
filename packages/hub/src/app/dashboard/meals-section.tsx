'use client';

import { useState } from 'react';
import type { MealLog } from '@my-hub/shared/types';

interface Props {
  meals: MealLog[];
  today: string;
  onChanged: () => void;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

function groupByMealType(meals: MealLog[]): Record<string, MealLog[]> {
  const groups: Record<string, MealLog[]> = {};
  for (const meal of meals) {
    (groups[meal.mealType] ??= []).push(meal);
  }
  return groups;
}

function totalKcal(meals: MealLog[]): number {
  return meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
}

export default function MealsSection({ meals, today, onChanged }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: '',
    kcal: '',
    mealType: 'lunch' as MealType,
    date: today,
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const grouped = groupByMealType(meals);
  const total = totalKcal(meals);

  async function addMeal() {
    if (!form.description || !form.mealType) return;
    setSaving(true);
    try {
      await fetch('/api/calories/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description,
          kcal: form.kcal ? Number(form.kcal) : undefined,
          mealType: form.mealType,
          date: form.date,
          protein: form.protein ? Number(form.protein) : undefined,
          carbs: form.carbs ? Number(form.carbs) : undefined,
          fat: form.fat ? Number(form.fat) : undefined,
          notes: form.notes || undefined,
        }),
      });
      setShowAdd(false);
      setForm({ description: '', kcal: '', mealType: 'lunch', date: today, protein: '', carbs: '', fat: '', notes: '' });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function deleteMealEntry(mealId: string) {
    setDeleting(mealId);
    try {
      await fetch(`/api/calories/meals/${mealId}`, { method: 'DELETE' });
      onChanged();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Meals — {today}</h2>
          {total > 0 && <p className="text-sm text-gray-500">{total} kcal total</p>}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
        >
          + Add meal
        </button>
      </div>

      {meals.length === 0 ? (
        <p className="text-gray-400 text-sm">No meals logged today.</p>
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.filter((t) => grouped[t]?.length).map((type) => (
            <div key={type}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                {MEAL_EMOJI[type]} {type}
              </h3>
              <div className="space-y-1">
                {grouped[type]!.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate">{meal.description}</span>
                      {meal.kcal && <span className="ml-2 text-gray-500">{meal.kcal} kcal</span>}
                      {(meal.protein || meal.carbs || meal.fat) && (
                        <span className="ml-2 text-xs text-gray-400">
                          {[
                            meal.protein ? `P: ${meal.protein}g` : null,
                            meal.carbs ? `C: ${meal.carbs}g` : null,
                            meal.fat ? `F: ${meal.fat}g` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => meal.mealId && deleteMealEntry(meal.mealId)}
                      disabled={deleting === meal.mealId}
                      className="ml-2 text-gray-400 hover:text-red-500 disabled:opacity-50 text-xs"
                    >
                      {deleting === meal.mealId ? '…' : '✕'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mt-4 border-t pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Add meal</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="text-xs text-gray-500">Description *</span>
              <input
                className="input mt-1"
                placeholder="e.g. grilled chicken with rice"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Meal type *</span>
              <select
                className="input mt-1"
                value={form.mealType}
                onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })}
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Date</span>
              <input
                className="input mt-1"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Calories (kcal)</span>
              <input
                className="input mt-1"
                type="number"
                value={form.kcal}
                onChange={(e) => setForm({ ...form, kcal: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Protein (g)</span>
              <input
                className="input mt-1"
                type="number"
                value={form.protein}
                onChange={(e) => setForm({ ...form, protein: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Carbs (g)</span>
              <input
                className="input mt-1"
                type="number"
                value={form.carbs}
                onChange={(e) => setForm({ ...form, carbs: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Fat (g)</span>
              <input
                className="input mt-1"
                type="number"
                value={form.fat}
                onChange={(e) => setForm({ ...form, fat: e.target.value })}
              />
            </label>
            <label className="col-span-2 block">
              <span className="text-xs text-gray-500">Notes</span>
              <input
                className="input mt-1"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addMeal}
              disabled={saving || !form.description}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
