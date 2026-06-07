'use client';

import { useState } from 'react';
import { IconButton, ConfirmModal } from '@/components';
import { ListChecksOutlineIcon, TrashOutlineIcon } from '@/components/icons';
import { DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { dateToString } from '@my-hub/shared/utils';
import { ShoppingListModal } from './ShoppingListModal';
import { DayCard } from './DayCard';
import { dateForDay, formatWeekLabel } from './menu.utils';
import type { LoggedMeals } from './menu.utils';
import type { WeeklyMenu, WeeklyMenuMeal } from './types';

type MenuDetailProps = {
  menu: WeeklyMenu;
  loggedMeals: LoggedMeals;
  gymDays: number[];
  onMealLogged: (day: DayOfWeek, mealType: MealType) => void;
  onMealSwapped: (day: DayOfWeek, updated: WeeklyMenuMeal) => void;
  onMealAdded: (day: DayOfWeek, added: WeeklyMenuMeal) => void;
  onDelete: (menuId: string) => Promise<void>;
  deleting: boolean;
  isCurrentWeek: boolean;
};

export function MenuDetail({
  menu,
  loggedMeals,
  gymDays,
  onMealLogged,
  onMealSwapped,
  onMealAdded,
  onDelete,
  deleting,
  isCurrentWeek,
}: MenuDetailProps) {
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const byDay = menu.meals.reduce<Record<number, WeeklyMenuMeal[]>>((acc, meal) => {
    (acc[meal.dayOfWeek] ??= []).push(meal);
    return acc;
  }, {});
  const today = dateToString();

  // Adherence summary: past/today days that have meals planned.
  // Bar uses partial-day credit: each day contributes loggedMeals/plannedMeals to the fill.
  const adherenceStats = DaysOfWeekValues.reduce(
    (stats, d) => {
      const dayMeals = byDay[d] ?? [];
      if (dateForDay(menu.weekStart, d) > today || dayMeals.length === 0) return stats;

      const loggedCount = dayMeals.filter(m => `${d}:${m.mealType}` in loggedMeals).length;
      return {
        pastDaysWithMealsCount: stats.pastDaysWithMealsCount + 1,
        fullyLoggedDaysCount: stats.fullyLoggedDaysCount + (loggedCount === dayMeals.length ? 1 : 0),
        creditSum: stats.creditSum + loggedCount / dayMeals.length,
      };
    },
    { pastDaysWithMealsCount: 0, fullyLoggedDaysCount: 0, creditSum: 0 },
  );
  const { pastDaysWithMealsCount, fullyLoggedDaysCount, creditSum } = adherenceStats;
  const adherencePct = pastDaysWithMealsCount > 0 ? Math.round((creditSum / pastDaysWithMealsCount) * 100) : 0;

  async function confirmDelete() {
    await onDelete(menu.menuId);
    setShowDeleteConfirm(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {menu.title ?? formatWeekLabel(menu.weekStart)}
            {isCurrentWeek && (
              <span className="ml-2 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                This week
              </span>
            )}
          </h2>
          {menu.notes && <p className="text-sm text-[var(--subtle)] mt-0.5">{menu.notes}</p>}
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label="Shopping list"
            icon={<ListChecksOutlineIcon />}
            onClick={() => setShowShoppingList(true)}
            variant="ghost"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
          />
          <IconButton
            label="Delete menu"
            icon={<TrashOutlineIcon />}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            variant="ghost"
            className="text-red-400 hover:text-red-300"
          />
        </div>
      </div>

      {showShoppingList && (
        <ShoppingListModal
          meals={menu.meals}
          weekLabel={formatWeekLabel(menu.weekStart)}
          onClose={() => setShowShoppingList(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete weekly menu"
          message="Delete this weekly menu? This cannot be undone."
          confirmLabel="Delete"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {pastDaysWithMealsCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
          <span className="text-xs text-[var(--muted)] shrink-0">Adherence</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--card3)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                adherencePct === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${adherencePct}%` }}
            />
          </div>
          <span
            className={`text-xs font-semibold shrink-0 ${
              adherencePct === 100 ? 'text-green-400' : 'text-[var(--text)]'
            }`}
          >
            {fullyLoggedDaysCount}/{pastDaysWithMealsCount} days
          </span>
        </div>
      )}

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 md:grid md:grid-cols-2 md:overflow-x-visible md:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {DaysOfWeekValues.map(day => (
          <DayCard
            key={day}
            day={day}
            meals={byDay[day] ?? []}
            menuId={menu.menuId}
            weekStart={menu.weekStart}
            isCurrentWeek={isCurrentWeek}
            today={today}
            loggedMeals={loggedMeals}
            isGymDay={gymDays.includes(day)}
            onMealLogged={mealType => onMealLogged(day, mealType)}
            onMealSwapped={onMealSwapped}
            onMealAdded={onMealAdded}
          />
        ))}
      </div>
    </div>
  );
}
