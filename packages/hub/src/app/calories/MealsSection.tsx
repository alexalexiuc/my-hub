'use client';

import { useState } from 'react';
import type { MealLog } from '@my-hub/shared/types';
import { dateToString } from '@my-hub/shared/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { SectionCard } from '@/components/SectionCard';
import { Button, Field } from '@/components';
import { MealType, MealTypes, MealTypesValues } from '@my-hub/shared/constants';
import { MEAL_LABEL } from './constants';

interface Props {
  meals: MealLog[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onChanged: () => void;
  goalCalories?: number | null;
  maxCalories?: number | null;
}

function groupByMealType(meals: MealLog[]): Record<MealType, MealLog[]> {
  const groups: Record<MealType, MealLog[]> = {} as Record<MealType, MealLog[]>;
  for (const meal of meals) {
    (groups[meal.mealType] ??= []).push(meal);
  }
  return groups;
}

function formatDateLabel(date: string): string {
  const now = new Date();
  const today = dateToString(now);
  now.setDate(now.getDate() - 1);
  const yesterday = dateToString(now);
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return dateToString(d);
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

export function MealsSection({ meals, selectedDate, onDateChange, onChanged, goalCalories, maxCalories }: Props) {
  const today = dateToString(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [showMeals, setShowMeals] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({
    description: '',
    kcal: '',
    mealType: MealTypes.Lunch as MealType,
    date: selectedDate,
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState<EditForm>({
    description: '',
    kcal: '',
    mealType: MealTypes.Lunch as MealType,
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

  // Calorie consumption donut
  const cap = (maxCalories ?? goalCalories) || null;
  const isOver = cap !== null && total > cap;
  const remaining = cap !== null ? Math.max(cap - total, 0) : null;
  const arcColor = cap !== null ? (isOver ? '#ef4444' : '#4ade80') : '#3f3f46';

  const donutData =
    cap !== null
      ? isOver
        ? [{ value: cap, key: 'eaten' }]
        : [
            { value: total, key: 'eaten' },
            { value: remaining!, key: 'remaining' },
          ]
      : [{ value: 1, key: 'empty' }];

  const overflowAmount = cap !== null && isOver ? Math.min(total - cap, cap) : 0;
  const overflowData =
    cap !== null
      ? [
          { value: overflowAmount, key: 'overflow' },
          { value: cap - overflowAmount, key: 'overflow-empty' },
        ]
      : [
          { value: 0, key: 'overflow' },
          { value: 0, key: 'overflow-empty' },
        ];

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
          kcal: editForm.kcal ? Math.round(Number(editForm.kcal)) : undefined,
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
          kcal: form.kcal ? Math.round(Number(form.kcal)) : undefined,
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
        mealType: MealTypes.Lunch,
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
      title="Meals"
      action={
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-all"
          title="Add meal"
          aria-label="Add meal"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      }
    >
      {/* Date navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          aria-label="Previous day"
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition"
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

      {/* Calorie consumption summary */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-5">
        {/* Donut */}
        <div className="relative w-[140px] h-[140px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {isOver ? (
                <>
                  <Pie
                    data={[{ value: 1, key: 'bg' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={62}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Pie
                    data={overflowData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={62}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                    animationDuration={800}
                  >
                    <Cell key="overflow" fill="#fecaca" />
                    <Cell key="overflow-empty" fill="transparent" />
                  </Pie>
                </>
              ) : (
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={62}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                  animationDuration={800}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={entry.key} fill={i === 0 ? arcColor : '#27272a'} />
                  ))}
                </Pie>
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${isOver ? 'text-red-400' : ''}`}>
              {cap !== null ? (isOver ? `+${total - cap}` : remaining) : total}
            </span>
            <span className="text-[11px] text-zinc-500">{cap !== null ? (isOver ? 'Over' : 'Remaining') : 'kcal'}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 w-full">
          <p className="text-sm text-zinc-400 mb-3">
            <span className="font-semibold text-zinc-200 text-lg">{total}</span>
            {cap !== null && <> / {cap}</>} kcal
          </p>
          <div className="grid grid-cols-3 gap-3">
            <MacroPill label="Carbs" value={totalCarbs} unit="g" color="bg-amber-400" />
            <MacroPill label="Protein" value={totalProtein} unit="g" color="bg-sky-400" />
            <MacroPill label="Fat" value={totalFat} unit="g" color="bg-rose-400" />
          </div>
        </div>
      </div>

      {/* Expandable meals list */}
      <div className="border-t border-zinc-700/50 pt-4">
        <button
          onClick={() => setShowMeals((v) => !v)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-3"
          aria-expanded={showMeals}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${showMeals ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span>{showMeals ? 'Hide meals' : `Show meals${total > 0 ? ` · ${total} kcal` : ''}`}</span>
        </button>

        {showMeals && (
          <>
            {meals.length === 0 ? (
              <p className="text-zinc-500 text-sm">No meals logged{selectedDate === today ? ' today' : ''}.</p>
            ) : (
              <div className="space-y-4">
                {MealTypesValues.filter((t) => grouped[t]?.length).map((type) => (
                  <div key={type}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                      {MEAL_LABEL[type]}
                    </h3>
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
                                  {MealTypesValues.map((t) => (
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
                                  step="1"
                                  min="0"
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
          </>
        )}
      </div>

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
                {MealTypesValues.map((t) => (
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
                step="1"
                min="0"
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

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="rounded-lg bg-zinc-800/80 border border-zinc-700/50 px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-sm font-semibold">
        {value} <span className="text-xs font-normal text-zinc-500">{unit}</span>
      </p>
    </div>
  );
}
