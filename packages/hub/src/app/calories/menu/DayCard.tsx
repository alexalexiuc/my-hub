'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { Button, Select, Input } from '@/components';
import { PlusOutlineIcon } from '@/components/icons';
import { DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { MEAL_LABEL } from '@/app/calories/constants';
import {
  LogDayBodySchema,
  LogDayResponseSchema,
  MenuMealResponseSchema,
  MenuMealWriteSchema,
} from '@/app/api/calories/menu/menu.schemas';
import { MealRow } from './MealRow';
import { MEAL_ORDER, dateForDay } from './menu.utils';
import type { LoggedMeals } from './menu.utils';
import type { WeeklyMenuMeal } from './types';
import {
  AddMealFormSchema,
  defaultAddMealFormValues,
  addMealFormToBody,
  type AddMealFormValues,
} from './menu-form.schema';

type DayCardProps = {
  day: DayOfWeek;
  meals: WeeklyMenuMeal[];
  menuId: string;
  weekStart: string;
  isCurrentWeek: boolean;
  today: string;
  loggedMeals: LoggedMeals;
  isGymDay: boolean;
  onMealLogged: (mealType: MealType) => void;
  onMealSwapped: (day: DayOfWeek, updated: WeeklyMenuMeal) => void;
  onMealAdded: (day: DayOfWeek, added: WeeklyMenuMeal) => void;
};

export function DayCard({
  day,
  meals,
  menuId,
  weekStart,
  isCurrentWeek,
  today,
  loggedMeals,
  isGymDay,
  onMealLogged,
  onMealSwapped,
  onMealAdded,
}: DayCardProps) {
  const [loggingAll, setLoggingAll] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const dayKcal = meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const dayDate = dateForDay(weekStart, day);
  const isToday = isCurrentWeek && dayDate === today;
  const isFuture = dayDate > today;

  const plannedTypes = new Set(meals.map(m => m.mealType));
  const availableTypes = MEAL_ORDER.filter(mt => !plannedTypes.has(mt));

  const addMealForm = useForm<AddMealFormValues>({
    resolver: zodResolver(AddMealFormSchema),
    defaultValues: defaultAddMealFormValues(availableTypes[0] ?? 'snack'),
  });

  function setAddFormOpen(open: boolean) {
    addMealForm.reset(defaultAddMealFormValues(availableTypes[0] ?? 'snack'));
    setShowAddForm(open);
  }

  async function handleAddMeal(values: AddMealFormValues) {
    const data = await apiFetch(`/api/calories/menu/${menuId}/meals`, {
      method: 'POST',
      body: { dayOfWeek: day, ...addMealFormToBody(values) },
      bodySchema: MenuMealWriteSchema,
      responseSchema: MenuMealResponseSchema,
    });
    onMealAdded(day, data.meal);
    setAddFormOpen(false);
  }

  const mealByType = new Map(meals.map(m => [m.mealType, m]));
  const orderedMeals = MEAL_ORDER.flatMap(mt => {
    const meal = mealByType.get(mt);
    return meal ? [{ meal, logged: `${day}:${mt}` in loggedMeals }] : [];
  });
  const unloggedMeals = orderedMeals.flatMap(({ meal, logged }) => (logged ? [] : [meal]));

  const allLogged = unloggedMeals.length === 0 && meals.length > 0;
  const loggedCount = meals.length - unloggedMeals.length;

  async function handleLogAll() {
    setLoggingAll(true);
    try {
      await Promise.all(
        unloggedMeals.map(m =>
          Promise.all([
            apiFetch('/api/calories/meals', {
              method: 'POST',
              body: {
                description: m.description,
                mealType: m.mealType,
                date: dayDate,
                kcal: m.kcal ?? undefined,
                protein: m.protein ?? undefined,
                carbs: m.carbs ?? undefined,
                fat: m.fat ?? undefined,
              },
            }),
            apiFetch(`/api/calories/menu/${menuId}/log-day`, {
              method: 'POST',
              body: { dayOfWeek: day, loggedDate: dayDate, mealType: m.mealType },
              bodySchema: LogDayBodySchema,
              responseSchema: LogDayResponseSchema,
            }),
          ]).then(() => onMealLogged(m.mealType)),
        ),
      );
    } finally {
      setLoggingAll(false);
    }
  }

  return (
    <div
      className={`snap-start shrink-0 w-[88vw] md:w-auto rounded-xl border p-4 flex flex-col gap-3 ${
        isToday
          ? 'border-green-500/60 bg-green-500/5'
          : isFuture
            ? 'border-[var(--border)] bg-[var(--card2)] opacity-50'
            : 'border-[var(--border)] bg-[var(--card2)]'
      }`}
    >
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-[var(--text)]">{DAY_LABELS[day]}</span>
          {isToday && (
            <span className="rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent)] uppercase tracking-wide">
              Today
            </span>
          )}
          {isGymDay && <span title="Gym day">💪</span>}
          {!isFuture && !allLogged && meals.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--card3)] text-[var(--muted)]">
              {loggedCount}/{meals.length}
            </span>
          )}
        </div>
        {dayKcal > 0 && <span className="text-xs font-medium text-[var(--accent)]">{dayKcal} kcal</span>}
      </div>

      {/* Meals */}
      {meals.length === 0 ? (
        <p className="text-xs text-[var(--subtle)] italic">No meals planned</p>
      ) : (
        <div className="flex flex-col gap-2 flex-1">
          {orderedMeals.map(({ meal, logged }) => (
            <MealRow
              key={meal.mealType}
              meal={meal}
              menuId={menuId}
              dayOfWeek={day}
              dayDate={dayDate}
              logged={logged}
              isFuture={isFuture}
              onLogged={() => onMealLogged(meal.mealType)}
              onSwapped={updated => onMealSwapped(day, updated)}
            />
          ))}
        </div>
      )}

      {/* Add meal inline form */}
      {availableTypes.length > 0 &&
        (showAddForm ? (
          <form
            onSubmit={addMealForm.handleSubmit(handleAddMeal)}
            className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5"
          >
            <div className="flex gap-1.5">
              <Select {...addMealForm.register('mealType')} className="px-2 py-1 text-[10px]">
                {availableTypes.map(mt => (
                  <option key={mt} value={mt}>
                    {MEAL_LABEL[mt]}
                  </option>
                ))}
              </Select>
              <Input
                {...addMealForm.register('kcal')}
                type="number"
                placeholder="kcal"
                className="w-16 px-2 py-1 text-[10px]"
              />
            </div>
            <Input
              {...addMealForm.register('description')}
              type="text"
              placeholder="What will you eat?"
              className="px-2 py-1 text-xs"
            />
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="neutral"
                size="xs"
                className="flex-1"
                onClick={() => setAddFormOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="accent"
                size="xs"
                className="flex-1"
                disabled={!addMealForm.formState.isValid}
                loading={addMealForm.formState.isSubmitting}
              >
                Add
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAddFormOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] py-1.5 text-[10px] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
          >
            <PlusOutlineIcon className="size-3" />
            Add meal
          </Button>
        ))}

      {/* Log all button */}
      {meals.length > 0 && (
        <div className="mt-auto border-t border-[var(--border)] pt-2 h-10 flex items-center justify-center">
          {allLogged ? (
            <p className="text-xs text-green-400 font-medium text-center">✓ Full day logged</p>
          ) : isFuture ? null : (
            <Button
              type="button"
              variant="ghost"
              onClick={handleLogAll}
              loading={loggingAll}
              className="w-full rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-3 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20"
            >
              Log full day ✓
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
