'use client';

import { useState } from 'react';
import type { MealLog } from '@my-hub/shared/types';
import SectionCard from '@/components/section-card';
import Field from '@/components/field';
import Button from '@/components/button';

interface Props {
  meals: MealLog[];
  today: string;
  onChanged: () => void;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function groupByMealType(meals: MealLog[]): Record<string, MealLog[]> {
  const groups: Record<string, MealLog[]> = {};
  for (const meal of meals) {
    (groups[meal.mealType] ??= []).push(meal);
  }
  return groups;
}

export default function MealsSection({ meals, today, onChanged }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  const grouped = groupByMealType(meals);
  const total = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);

  async function addMeal() {
    if (!form.description) return;
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
    <SectionCard
      title={`Meals — ${today}${total > 0 ? ` · ${total} kcal` : ''}`}
      action={
        <Button size="sm" onClick={() => setShowAdd(true)}>
          + Add meal
        </Button>
      }
    >
      {meals.length === 0 ? (
        <p className="text-gray-400 text-sm">No meals logged today.</p>
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.filter((t) => grouped[t]?.length).map((type) => (
            <div key={type}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {MEAL_LABEL[type]}
              </h3>
              <div className="space-y-1">
                {grouped[type]!.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{meal.description}</span>
                      {meal.kcal ? <span className="ml-2 text-gray-500">{meal.kcal} kcal</span> : null}
                      {(meal.protein || meal.carbs || meal.fat) && (
                        <span className="ml-2 text-xs text-gray-400">
                          {[
                            meal.protein ? `P ${meal.protein}g` : null,
                            meal.carbs ? `C ${meal.carbs}g` : null,
                            meal.fat ? `F ${meal.fat}g` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => meal.mealId && deleteMealEntry(meal.mealId)}
                      disabled={deleting === meal.mealId}
                      className="ml-3 text-gray-300 hover:text-red-500 disabled:opacity-50 text-xs"
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
            <Field label="Description *" className="col-span-2">
              <input
                className="input"
                placeholder="e.g. grilled chicken with rice"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Meal type *">
              <select className="input" value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })}>
                {MEAL_TYPES.map((t) => <option key={t} value={t}>{MEAL_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Calories (kcal)">
              <input className="input" type="number" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} />
            </Field>
            <Field label="Protein (g)">
              <input className="input" type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
            </Field>
            <Field label="Carbs (g)">
              <input className="input" type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} />
            </Field>
            <Field label="Fat (g)">
              <input className="input" type="number" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={addMeal} loading={saving} disabled={!form.description}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
