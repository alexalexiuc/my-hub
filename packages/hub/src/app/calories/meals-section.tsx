'use client';

import { useState } from 'react';
import type { MealLog } from '@my-hub/shared/types';
import SectionCard from '@/components/section-card';
import Field from '@/components/field';
import Button from '@/components/button';

interface Props {
  meals: MealLog[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onChanged: () => void;
  goalCalories?: number | null;
  minCalories?: number | null;
  maxCalories?: number | null;
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

function formatDateLabel(date: string): string {
  const today = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

interface EditForm {
  description: string;
  kcal: string;
  mealType: MealType;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
}

export default function MealsSection({
  meals,
  selectedDate,
  onDateChange,
  onChanged,
  goalCalories,
  minCalories,
  maxCalories,
}: Props) {
  const today = new Date().toISOString().split('T')[0]!;
  const [showAdd, setShowAdd] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({
    description: '',
    kcal: '',
    mealType: 'lunch' as MealType,
    date: selectedDate,
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState<EditForm>({
    description: '',
    kcal: '',
    mealType: 'lunch',
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
  });

  const grouped = groupByMealType(meals);
  const total = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const totalProtein = Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0));
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0));
  const totalFat = Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0));
  const hasMacros = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;

  // Slim progress info
  const cap = (maxCalories ?? goalCalories) || null;
  const isOver = cap !== null && total > cap;
  const isUnder = cap !== null && minCalories && total < minCalories;
  const progressPct = cap !== null ? Math.min(Math.round((total / cap) * 100), 100) : null;
  const barColor = isOver ? 'bg-red-500' : isUnder ? 'bg-yellow-400' : 'bg-green-500';

  function startEdit(meal: MealLog) {
    setEditingMealId(meal.mealId);
    setEditForm({
      description: meal.description,
      kcal: meal.kcal?.toString() ?? '',
      mealType: meal.mealType as MealType,
      protein: meal.protein?.toString() ?? '',
      carbs: meal.carbs?.toString() ?? '',
      fat: meal.fat?.toString() ?? '',
      notes: meal.notes ?? '',
    });
  }

  async function saveEdit() {
    if (!editingMealId || !editForm.description) return;
    setEditSaving(true);
    try {
      await fetch(`/api/calories/meals/${editingMealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editForm.description,
          kcal: editForm.kcal ? Number(editForm.kcal) : undefined,
          mealType: editForm.mealType,
          protein: editForm.protein ? Number(editForm.protein) : undefined,
          carbs: editForm.carbs ? Number(editForm.carbs) : undefined,
          fat: editForm.fat ? Number(editForm.fat) : undefined,
          notes: editForm.notes || undefined,
        }),
      });
      setEditingMealId(null);
      onChanged();
    } finally {
      setEditSaving(false);
    }
  }

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
          date: selectedDate,
          protein: form.protein ? Number(form.protein) : undefined,
          carbs: form.carbs ? Number(form.carbs) : undefined,
          fat: form.fat ? Number(form.fat) : undefined,
          notes: form.notes || undefined,
        }),
      });
      setShowAdd(false);
      setForm({
        description: '',
        kcal: '',
        mealType: 'lunch',
        date: selectedDate,
        protein: '',
        carbs: '',
        fat: '',
        notes: '',
      });
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
      title={`Meals${total > 0 ? ` · ${total} kcal` : ''}`}
      action={
        <button
          onClick={() => setShowAdd(true)}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition"
          title="Add meal"
          aria-label="Add meal"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      }
    >
      {/* Date navigation + slim progress */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onDateChange(shiftDate(selectedDate, -1))}
            aria-label="Previous day"
            className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition"
            aria-label="Previous day"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-medium">{formatDateLabel(selectedDate)}</span>
          <button
            onClick={() => onDateChange(shiftDate(selectedDate, 1))}
            disabled={selectedDate >= today}
            aria-label="Next day"
            className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next day"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        {/* Slim progress bar */}
        {cap !== null && (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>
                {total} / {cap} kcal
              </span>
              <span className={isOver ? 'text-red-400' : isUnder ? 'text-yellow-400' : 'text-green-400'}>
                {isOver ? `${total - cap} over` : `${cap - total} left`}
              </span>
            </div>
          </div>
        )}
      </div>

      {meals.length === 0 ? (
        <p className="text-zinc-500 text-sm">No meals logged{selectedDate === today ? ' today' : ''}.</p>
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.filter((t) => grouped[t]?.length).map((type) => (
            <div key={type}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">{MEAL_LABEL[type]}</h3>
              <div className="space-y-1">
                {grouped[type]!.map((meal) =>
                  editingMealId === meal.mealId ? (
                    <div key={meal.id} className="rounded-lg bg-zinc-800 border border-zinc-600 p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Description *" className="col-span-2">
                          <input
                            className="input"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            autoFocus
                          />
                        </Field>
                        <Field label="Meal type">
                          <select
                            className="input"
                            value={editForm.mealType}
                            onChange={(e) => setEditForm({ ...editForm, mealType: e.target.value as MealType })}
                          >
                            {MEAL_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {MEAL_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Calories (kcal)">
                          <input
                            className="input"
                            type="number"
                            value={editForm.kcal}
                            onChange={(e) => setEditForm({ ...editForm, kcal: e.target.value })}
                          />
                        </Field>
                        <Field label="Protein (g)">
                          <input
                            className="input"
                            type="number"
                            value={editForm.protein}
                            onChange={(e) => setEditForm({ ...editForm, protein: e.target.value })}
                          />
                        </Field>
                        <Field label="Carbs (g)">
                          <input
                            className="input"
                            type="number"
                            value={editForm.carbs}
                            onChange={(e) => setEditForm({ ...editForm, carbs: e.target.value })}
                          />
                        </Field>
                        <Field label="Fat (g)">
                          <input
                            className="input"
                            type="number"
                            value={editForm.fat}
                            onChange={(e) => setEditForm({ ...editForm, fat: e.target.value })}
                          />
                        </Field>
                        <Field label="Notes">
                          <input
                            className="input"
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={saveEdit} loading={editSaving} disabled={!editForm.description}>
                          {editSaving ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingMealId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm group cursor-pointer hover:bg-zinc-700/50"
                      onClick={() => meal.mealId && startEdit(meal)}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{meal.description}</span>
                        {meal.kcal ? <span className="ml-2 text-zinc-500">{meal.kcal} kcal</span> : null}
                        {(meal.protein || meal.carbs || meal.fat) && (
                          <span className="ml-2 text-xs text-zinc-500">
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
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                        {/* Pencil icon */}
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-zinc-500"
                        >
                          <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            meal.mealId && deleteMealEntry(meal.mealId);
                          }}
                          disabled={deleting === meal.mealId}
                          className="text-zinc-500 hover:text-red-400 disabled:opacity-50 text-xs"
                        >
                          {deleting === meal.mealId ? '…' : '✕'}
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}

          {/* Totals summary */}
          <div className="flex items-center justify-between rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-xs mt-2">
            <span className="font-medium text-zinc-300">Total</span>
            <div className="flex gap-3 text-zinc-400">
              <span>{total} kcal</span>
              {hasMacros && (
                <>
                  <span className="text-sky-400/80">P {totalProtein}g</span>
                  <span className="text-amber-400/80">C {totalCarbs}g</span>
                  <span className="text-rose-400/80">F {totalFat}g</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="mt-4 border-t border-zinc-700 pt-4 space-y-3">
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
              <select
                className="input"
                value={form.mealType}
                onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })}
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MEAL_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Calories (kcal)">
              <input
                className="input"
                type="number"
                value={form.kcal}
                onChange={(e) => setForm({ ...form, kcal: e.target.value })}
              />
            </Field>
            <Field label="Protein (g)">
              <input
                className="input"
                type="number"
                value={form.protein}
                onChange={(e) => setForm({ ...form, protein: e.target.value })}
              />
            </Field>
            <Field label="Carbs (g)">
              <input
                className="input"
                type="number"
                value={form.carbs}
                onChange={(e) => setForm({ ...form, carbs: e.target.value })}
              />
            </Field>
            <Field label="Fat (g)">
              <input
                className="input"
                type="number"
                value={form.fat}
                onChange={(e) => setForm({ ...form, fat: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={addMeal} loading={saving} disabled={!form.description}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
