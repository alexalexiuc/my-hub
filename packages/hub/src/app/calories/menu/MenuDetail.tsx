'use client';

import { useState } from 'react';
import { Card, IconButton, ConfirmModal } from '@/components';
import { ListChecksOutlineIcon, TrashOutlineIcon } from '@/components/icons';
import { DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek, GymTime, MealType } from '@my-hub/shared/constants';
import { dateToString, dayTargetKcal, formatWeekRangeStr } from '@my-hub/shared/utils';
import { ShoppingListModal } from './ShoppingListModal';
import { DayCard } from './DayCard';
import { MenuMetaSection } from './MenuMetaSection';
import { MobileDayView } from './MobileDayView';
import { dateForDay, targetPct, targetColorClasses, resolveDailyTarget } from './menu.utils';
import { TargetBar } from './TargetBar';
import type { LoggedMeals } from './menu.utils';
import type { WeeklyMenu, WeeklyMenuMeal } from './types';

type MenuDetailProps = {
  menu: WeeklyMenu;
  loggedMeals: LoggedMeals;
  gymDays: number[];
  /** Daily calorie target from the user's profile (goalCalories), or null if the profile is incomplete. */
  dailyTargetKcal: number | null;
  /** Extra kcal added to the daily target on gym days. */
  gymDayCalorieBonus: number;
  /** When the user trains — decides where the pre/post-workout meals sit in each day's order. */
  gymTime: GymTime | null;
  onMealLogChanged: (day: DayOfWeek, mealType: MealType, logged: boolean) => void;
  onMealSwapped: (day: DayOfWeek, updated: WeeklyMenuMeal) => void;
  onMealAdded: (day: DayOfWeek, added: WeeklyMenuMeal) => void;
  onMealDeleted: (day: DayOfWeek, mealType: MealType) => void;
  onMetaUpdated: (meta: { title: string | null; notes: string | null }) => void;
  onDelete: (menuId: string) => Promise<void>;
  deleting: boolean;
  isCurrentWeek: boolean;
};

export function MenuDetail({
  menu,
  loggedMeals,
  gymDays,
  dailyTargetKcal,
  gymDayCalorieBonus,
  gymTime,
  onMealLogChanged,
  onMealSwapped,
  onMealAdded,
  onMealDeleted,
  onMetaUpdated,
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

  const todayIndex = isCurrentWeek ? DaysOfWeekValues.find(d => dateForDay(menu.weekStart, d) === today) : undefined;

  // Adherence summary: how much of the whole week's plan is logged so far, across every day
  // that has meals planned — including days later in the week that haven't happened yet
  // (they count as 0% logged until then, so the bar reflects "how complete is this week",
  // not just "compliance for days already passed").
  // Bar uses partial-day credit: each day contributes loggedMeals/plannedMeals to the fill.
  const adherenceStats = DaysOfWeekValues.reduce(
    (stats, d) => {
      const dayMeals = byDay[d] ?? [];
      if (dayMeals.length === 0) return stats;

      const loggedCount = dayMeals.filter(m => `${d}:${m.mealType}` in loggedMeals).length;
      return {
        daysWithMealsCount: stats.daysWithMealsCount + 1,
        fullyLoggedDaysCount: stats.fullyLoggedDaysCount + (loggedCount === dayMeals.length ? 1 : 0),
        creditSum: stats.creditSum + loggedCount / dayMeals.length,
      };
    },
    { daysWithMealsCount: 0, fullyLoggedDaysCount: 0, creditSum: 0 },
  );
  const { daysWithMealsCount, fullyLoggedDaysCount, creditSum } = adherenceStats;
  const adherencePct = daysWithMealsCount > 0 ? Math.round((creditSum / daysWithMealsCount) * 100) : 0;

  // Weekly summary: planned kcal vs. target (macro breakdown deliberately omitted —
  // that tracking already lives in the Today tab). The target is summed only over
  // days that actually have meals planned: a menu created mid-week plans only the
  // remaining days, and comparing those against a full 7-day target would always
  // read as far under target.
  const { baseTarget, isEstimated: isTargetEstimated } = resolveDailyTarget(dailyTargetKcal);
  const plannedTotalKcal = menu.meals.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const weeklyTargetKcal = DaysOfWeekValues.reduce<number>(
    (s, d) =>
      (byDay[d]?.length ?? 0) > 0 ? s + dayTargetKcal(baseTarget, gymDays.includes(d), gymDayCalorieBonus) : s,
    0,
  );
  const weeklyPct = targetPct(plannedTotalKcal, weeklyTargetKcal);
  const weeklyColors = targetColorClasses(weeklyPct, isTargetEstimated);
  const gymTargetKcal = dayTargetKcal(baseTarget, true, gymDayCalorieBonus);

  async function confirmDelete() {
    await onDelete(menu.menuId);
    setShowDeleteConfirm(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {/* The menu's name, where a name reads as one — beside the week it belongs to. Rendered
            only when set: an empty heading is still a heading to a screen reader. */}
        {menu.title && <h2 className="truncate text-base font-semibold text-[var(--text)]">{menu.title}</h2>}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <MenuMetaSection menuId={menu.menuId} title={menu.title} notes={menu.notes} onUpdated={onMetaUpdated} />
          <IconButton
            label="Shopping list"
            icon={<ListChecksOutlineIcon />}
            onClick={() => setShowShoppingList(true)}
            variant="ghost"
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--accent)] hover:text-[var(--accent-hover)]"
          />
          <IconButton
            label="Delete menu"
            icon={<TrashOutlineIcon />}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            variant="ghost"
            className="flex min-h-11 min-w-11 items-center justify-center text-red-400 hover:text-red-300"
          />
        </div>
      </div>

      {showShoppingList && (
        <ShoppingListModal
          menuId={menu.menuId}
          weekLabel={formatWeekRangeStr(menu.weekStart)}
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

      {menu.meals.length > 0 && (
        <Card className="-mx-4 flex flex-col gap-2 md:mx-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              Week plan vs. target
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${weeklyColors.text}`}>{plannedTotalKcal.toLocaleString()}</span>
              <span className="text-sm text-[var(--subtle)]">/ {weeklyTargetKcal.toLocaleString()} kcal planned</span>
              {weeklyPct !== null && <span className={`text-sm font-semibold ${weeklyColors.text}`}>{weeklyPct}%</span>}
            </div>
          </div>
          <TargetBar pct={weeklyPct} colors={weeklyColors} size="md" />
          <p className="text-xs text-[var(--subtle)]">
            {gymDays.length > 0 && `Target rises to ${gymTargetKcal.toLocaleString()} kcal on gym days. `}
            Macro breakdown stays in the Today tab.
          </p>
        </Card>
      )}

      {daysWithMealsCount > 0 && (
        <Card className="-mx-4 flex items-center gap-3 md:mx-0">
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
            {fullyLoggedDaysCount}/{daysWithMealsCount} days
          </span>
        </Card>
      )}

      {/* Desktop: grid of all seven days at once — the whole week is on screen, so there is
          nothing to page through. */}
      <div data-layout="desktop" className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DaysOfWeekValues.map(day => (
          <DayCard
            key={day}
            variant="grid"
            day={day}
            meals={byDay[day] ?? []}
            menuId={menu.menuId}
            weekStart={menu.weekStart}
            isCurrentWeek={isCurrentWeek}
            today={today}
            loggedMeals={loggedMeals}
            isGymDay={gymDays.includes(day)}
            dailyTargetKcal={dailyTargetKcal}
            gymDayCalorieBonus={gymDayCalorieBonus}
            gymTime={gymTime}
            onMealLogChanged={(mealType, logged) => onMealLogChanged(day, mealType, logged)}
            onMealSwapped={onMealSwapped}
            onMealAdded={onMealAdded}
            onMealDeleted={onMealDeleted}
          />
        ))}
      </div>

      {/* Phones: one day at a time — a nested horizontal scroll or a carousel of stacked cards
          both forced every card to the height of the fullest day; paging through a single
          rendered day avoids that entirely. */}
      <div data-layout="mobile" className="md:hidden">
        <MobileDayView
          weekStart={menu.weekStart}
          menuId={menu.menuId}
          isCurrentWeek={isCurrentWeek}
          today={today}
          byDay={byDay}
          todayIndex={todayIndex}
          loggedMeals={loggedMeals}
          gymDays={gymDays}
          dailyTargetKcal={dailyTargetKcal}
          gymDayCalorieBonus={gymDayCalorieBonus}
          gymTime={gymTime}
          onMealLogChanged={onMealLogChanged}
          onMealSwapped={onMealSwapped}
          onMealAdded={onMealAdded}
          onMealDeleted={onMealDeleted}
        />
      </div>
    </div>
  );
}
