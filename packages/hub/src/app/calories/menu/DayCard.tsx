'use client';

import { useState } from 'react';
import { Button } from '@/components';
import { PlusOutlineIcon, DumbbellIcon } from '@/components/icons';
import { DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { MealRow } from './MealRow';
import { MealEditorModal } from './MealEditorModal';
import {
  MEAL_ORDER,
  dateForDay,
  dayTargetKcal,
  setDayLogged,
  targetPct,
  targetColorClasses,
  resolveDailyTarget,
} from './menu.utils';
import { TargetBar } from './TargetBar';
import type { LoggedMeals } from './menu.utils';
import type { WeeklyMenuMeal } from './types';

type DayCardProps = {
  day: DayOfWeek;
  meals: WeeklyMenuMeal[];
  menuId: string;
  weekStart: string;
  isCurrentWeek: boolean;
  today: string;
  loggedMeals: LoggedMeals;
  isGymDay: boolean;
  /** Daily calorie target from the user's profile (goalCalories), or null if the profile is incomplete. */
  dailyTargetKcal: number | null;
  /** Extra kcal added to the daily target on gym days. */
  gymDayCalorieBonus: number;
  onMealLogChanged: (mealType: MealType, logged: boolean) => void;
  onMealSwapped: (day: DayOfWeek, updated: WeeklyMenuMeal) => void;
  onMealAdded: (day: DayOfWeek, added: WeeklyMenuMeal) => void;
  onMealDeleted: (day: DayOfWeek, mealType: MealType) => void;
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
  dailyTargetKcal,
  gymDayCalorieBonus,
  onMealLogChanged,
  onMealSwapped,
  onMealAdded,
  onMealDeleted,
}: DayCardProps) {
  const [loggingAll, setLoggingAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const dayKcal = meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const dayDate = dateForDay(weekStart, day);
  const isToday = isCurrentWeek && dayDate === today;
  const isFuture = dayDate > today;
  // Today counts as neither — the rest of the day is still plannable.
  const isPast = dayDate < today;

  const { baseTarget, isEstimated: isTargetEstimated } = resolveDailyTarget(dailyTargetKcal);
  const target = dayTargetKcal(baseTarget, isGymDay, gymDayCalorieBonus);
  const targetPercent = targetPct(dayKcal, target);
  const targetColors = targetColorClasses(targetPercent, isTargetEstimated);

  const plannedTypes = new Set(meals.map(m => m.mealType));
  const availableTypes = MEAL_ORDER.filter(mt => !plannedTypes.has(mt));

  const mealByType = new Map(meals.map(m => [m.mealType, m]));
  const orderedMeals = MEAL_ORDER.flatMap(mt => {
    const meal = mealByType.get(mt);
    return meal ? [{ meal, logged: `${day}:${mt}` in loggedMeals }] : [];
  });
  const unloggedMeals = orderedMeals.flatMap(({ meal, logged }) => (logged ? [] : [meal]));

  const allLogged = unloggedMeals.length === 0 && meals.length > 0;
  const loggedCount = meals.length - unloggedMeals.length;

  /**
   * Flip the whole day in one request. This used to fan out one call per meal, which meant N
   * round trips, N transactions and N separate state updates for a single tap — and a partial
   * failure left the day half-logged with the button already flipped back.
   */
  async function toggleLogAll(logged: boolean) {
    setLoggingAll(true);
    try {
      await setDayLogged(menuId, dayDate, day, logged);
      for (const { meal } of orderedMeals) onMealLogChanged(meal.mealType, logged);
    } finally {
      setLoggingAll(false);
    }
  }

  // No width or shrink classes: stacked on phones the card fills the column on its own, and in
  // the desktop grid the track sizes it. It also takes only the height its own meals need — the
  // card no longer shares a row with the fullest day of the week.
  return (
    <div
      data-day={day}
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
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
          <span className={`text-sm font-bold ${isToday ? 'text-green-400' : 'text-[var(--text)]'}`}>
            {DAY_LABELS[day]}
          </span>
          {isGymDay && <DumbbellIcon className="size-3.5 text-[var(--accent)]" title="Gym day" />}
          {!isFuture && !allLogged && meals.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--card3)] text-[var(--muted)]">
              {loggedCount}/{meals.length}
            </span>
          )}
        </div>
        {dayKcal > 0 && <span className="text-xs font-medium text-[var(--accent)]">{dayKcal} kcal</span>}
      </div>

      {/* Daily target bar */}
      {meals.length > 0 && (
        <div className="flex flex-col gap-1">
          <TargetBar pct={targetPercent} colors={targetColors} size="sm" />
          <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span>
              {target} target{isGymDay ? ' (gym)' : ''}
            </span>
            {targetPercent !== null && <span className={`font-medium ${targetColors.text}`}>{targetPercent}%</span>}
          </div>
        </div>
      )}

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
              today={today}
              logged={logged}
              onLogChanged={logged => onMealLogChanged(meal.mealType, logged)}
              onSwapped={updated => onMealSwapped(day, updated)}
              onDeleted={() => onMealDeleted(day, meal.mealType)}
            />
          ))}
        </div>
      )}

      {/* Add meal — opens the same detail modal the pencil does, so both write the same fields.
          Disabled once the day has passed: the menu is the plan, and back-filling it after the
          fact would also let adherence be scored against a plan written to match. Recording what
          was actually eaten belongs in the Today tab, which can log against any date.
          The title sits on the wrapper because Chrome fires no mouse events — and so shows no
          tooltip — on a disabled button. */}
      {availableTypes.length > 0 && (
        <span className="block" title={isPast ? 'Past day — log what you ate from the Today tab' : undefined}>
          <Button
            type="button"
            variant="ghost"
            disabled={isPast}
            onClick={() => setShowAddModal(true)}
            className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] py-1.5 text-[10px] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
          >
            <PlusOutlineIcon className="size-3" />
            Add meal
          </Button>
        </span>
      )}

      {showAddModal && (
        <MealEditorModal
          mode="add"
          availableTypes={availableTypes}
          menuId={menuId}
          dayOfWeek={day}
          onClose={() => setShowAddModal(false)}
          onSaved={added => onMealAdded(day, added)}
        />
      )}

      {/* Log all / undo all. Logging seven meals takes one tap, so undoing them must too —
          otherwise a mistaken "Log full day" costs one click to make and seven to take back. */}
      {meals.length > 0 && (
        <div className="mt-auto border-t border-[var(--border)] pt-2 h-10 flex items-center justify-center">
          {allLogged ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void toggleLogAll(false)}
              loading={loggingAll}
              title="Undo — I didn't eat this day's meals"
              className="w-full rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400 hover:border-red-400/50 hover:text-red-400"
            >
              ✓ Full day logged
            </Button>
          ) : isFuture ? null : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void toggleLogAll(true)}
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
