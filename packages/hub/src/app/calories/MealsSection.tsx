'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import { dateToString } from '@my-hub/shared/utils';
import { SectionCard } from '@/components/SectionCard';
import { Button, Field, Input, Select } from '@/components';
import {
  PencilIcon,
  PlusOutlineIcon,
  ChevronLeftOutlineIcon,
  ChevronRightOutlineIcon,
  ChevronDownOutlineIcon,
} from '@/components/icons';
import { MealTypesValues } from '@my-hub/shared/constants';
import { MEAL_LABEL } from './constants';
import { groupByMealType, formatDateLabel, shiftDate } from './calories.utils';
import { CaloriesDonut } from './CaloriesDonut';
import {
  MealFormSchema,
  type MealFormValues,
  defaultMealFormValues,
  mealToFormValues,
  formToAddBody,
  formToUpdateBody,
} from './meals-form.schema';

interface Props {
  meals: MealLog[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onChanged: () => void;
  goalCalories?: number | null;
  maxCalories?: number | null;
}

export function MealsSection({ meals, selectedDate, onDateChange, onChanged, goalCalories, maxCalories }: Props) {
  const today = dateToString(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [showMeals, setShowMeals] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const addForm = useForm<MealFormValues>({
    resolver: zodResolver(MealFormSchema),
    defaultValues: defaultMealFormValues,
  });

  const editForm = useForm<MealFormValues>({
    resolver: zodResolver(MealFormSchema),
    defaultValues: defaultMealFormValues,
  });

  const grouped = groupByMealType(meals);
  const total = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const totalProtein = Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0));
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0));
  const totalFat = Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0));
  const hasMacros = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;
  const cap = (maxCalories ?? goalCalories) || null;

  function startEdit(meal: MealLog) {
    setEditingMealId(meal.mealId);
    editForm.reset(mealToFormValues(meal));
  }

  async function saveEdit(values: MealFormValues) {
    if (!editingMealId) return;
    await apiFetch(`/api/calories/meals/${editingMealId}`, {
      method: 'PATCH',
      body: formToUpdateBody(values),
    });
    setEditingMealId(null);
    onChanged();
  }

  async function addMeal(values: MealFormValues) {
    await apiFetch('/api/calories/meals', {
      method: 'POST',
      body: formToAddBody(values, selectedDate),
    });
    setShowAdd(false);
    addForm.reset(defaultMealFormValues);
    onChanged();
  }

  async function deleteMealEntry(mealId: string) {
    setDeleting(mealId);
    try {
      await apiFetch(`/api/calories/meals/${mealId}`, { method: 'DELETE' });
      onChanged();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <SectionCard
      title="Meals"
      action={
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShowAdd(true)}
          title="Add meal"
          aria-label="Add meal"
          className="flex items-center gap-1.5 px-2.5 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60"
        >
          <PlusOutlineIcon className="size-3" />
          Add
        </Button>
      }
    >
      {/* Date navigation */}
      <div className="flex items-center justify-between mb-5">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          aria-label="Previous day"
          className="w-8 h-8 rounded-md flex items-center justify-center p-0 hover:text-zinc-100 hover:bg-zinc-700"
        >
          <ChevronLeftOutlineIcon />
        </Button>
        <span className="text-sm font-medium">{formatDateLabel(selectedDate)}</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onDateChange(shiftDate(selectedDate, 1))}
          disabled={selectedDate >= today}
          aria-label="Next day"
          className="w-8 h-8 rounded-md flex items-center justify-center p-0 hover:text-zinc-100 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRightOutlineIcon />
        </Button>
      </div>

      {/* Calorie consumption summary */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-5">
        <CaloriesDonut eaten={total} cap={cap} textSize="text-2xl" />
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
          {cap === null && (
            <p className="text-xs text-zinc-500 mt-3">
              No calorie goal set.{' '}
              <a href="/profile" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
                Complete your profile
              </a>{' '}
              to see targets.
            </p>
          )}
        </div>
      </div>

      {/* Expandable meals list */}
      <div className="border-t border-zinc-700/50 pt-4">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShowMeals(v => !v)}
          aria-expanded={showMeals}
          className="flex items-center gap-2 text-sm px-0 py-0 mb-3 hover:bg-transparent"
        >
          <ChevronDownOutlineIcon className={`size-3.5 transition-transform ${showMeals ? 'rotate-180' : ''}`} />
          <span>{showMeals ? 'Hide meals' : `Show meals${total > 0 ? ` · ${total} kcal` : ''}`}</span>
        </Button>

        {showMeals && (
          <>
            {meals.length === 0 ? (
              <p className="text-zinc-500 text-sm">No meals logged{selectedDate === today ? ' today' : ''}.</p>
            ) : (
              <div className="space-y-4">
                {MealTypesValues.filter(t => grouped[t]?.length).map(type => (
                  <div key={type}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                      {MEAL_LABEL[type]}
                    </h3>
                    <div className="space-y-1">
                      {grouped[type]!.map(meal =>
                        editingMealId === meal.mealId ? (
                          <form
                            key={meal.id}
                            onSubmit={editForm.handleSubmit(saveEdit)}
                            className="rounded-lg bg-zinc-800 border border-zinc-600 p-3 space-y-3"
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Description *" className="col-span-2">
                                <Input {...editForm.register('description')} autoFocus />
                              </Field>
                              <Field label="Meal type">
                                <Select
                                  {...editForm.register('mealType')}
                                  options={MealTypesValues.map(t => ({ value: t, label: MEAL_LABEL[t] }))}
                                />
                              </Field>
                              <Field label="Calories (kcal)">
                                <Input type="number" step="1" min="0" {...editForm.register('kcal')} />
                              </Field>
                              <Field label="Protein (g)">
                                <Input type="number" {...editForm.register('protein')} />
                              </Field>
                              <Field label="Carbs (g)">
                                <Input type="number" {...editForm.register('carbs')} />
                              </Field>
                              <Field label="Fat (g)">
                                <Input type="number" {...editForm.register('fat')} />
                              </Field>
                              <Field label="Notes">
                                <Input {...editForm.register('notes')} />
                              </Field>
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" loading={editForm.formState.isSubmitting}>
                                {editForm.formState.isSubmitting ? 'Saving…' : 'Save'}
                              </Button>
                              <Button type="button" variant="secondary" onClick={() => setEditingMealId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </form>
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
                              <PencilIcon className="text-zinc-500" />
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={e => {
                                  e.stopPropagation();
                                  meal.mealId && deleteMealEntry(meal.mealId);
                                }}
                                disabled={deleting === meal.mealId}
                                className="text-zinc-500 hover:text-red-400 px-0 py-0 hover:bg-transparent"
                              >
                                {deleting === meal.mealId ? '…' : '✕'}
                              </Button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}

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
        <form onSubmit={addForm.handleSubmit(addMeal)} className="mt-4 border-t border-zinc-700 pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Add meal</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Description *" className="col-span-2">
              <Input {...addForm.register('description')} placeholder="e.g. grilled chicken with rice" autoFocus />
            </Field>
            <Field label="Meal type *">
              <Select
                {...addForm.register('mealType')}
                options={MealTypesValues.map(t => ({ value: t, label: MEAL_LABEL[t] }))}
              />
            </Field>
            <Field label="Calories (kcal)">
              <Input type="number" step="1" min="0" {...addForm.register('kcal')} />
            </Field>
            <Field label="Protein (g)">
              <Input type="number" {...addForm.register('protein')} />
            </Field>
            <Field label="Carbs (g)">
              <Input type="number" {...addForm.register('carbs')} />
            </Field>
            <Field label="Fat (g)">
              <Input type="number" {...addForm.register('fat')} />
            </Field>
            <Field label="Notes">
              <Input {...addForm.register('notes')} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={addForm.formState.isSubmitting}>
              {addForm.formState.isSubmitting ? 'Adding…' : 'Add'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </form>
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
