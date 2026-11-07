'use client';

import { useState } from 'react';
import { Card, IconButton, ConfirmModal } from '@/components';
import { DumbbellIcon, ListChecksOutlineIcon, ShareOutlineIcon, TrashOutlineIcon } from '@/components/icons';
import { DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek, GymTime, MealType } from '@my-hub/shared/constants';
import { dateToString, formatWeekRangeStr } from '@my-hub/shared/utils';
import { ShoppingListModal } from './ShoppingListModal';
import { ShareMenuModal } from './ShareMenuModal';
import { DayCard } from './DayCard';
import { MenuMetaSection } from './MenuMetaSection';
import { MobileDayView } from './MobileDayView';
import { dateForDay, formatKcalRange, planStatusLabel, planWeek } from './menu.utils';
import { RangeBar } from './RangeBar';
import type { DayTarget, LoggedMeals } from './menu.utils';
import type { WeeklyMenu, WeeklyMenuMeal } from './types';

type MenuDetailProps = {
  menu: WeeklyMenu;
  loggedMeals: LoggedMeals;
  gymDays: number[];
  /** Each weekday's calorie range, 0=Mon … 6=Sun, as `GET /api/calories/menu` resolved it. */
  dayTargets: DayTarget[];
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
  dayTargets,
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
  const [showShareModal, setShowShareModal] = useState(false);
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

  // Weekly summary: planned kcal vs. target (macro breakdown deliberately omitted — that
  // tracking already lives in the Today tab).
  const { days: plans, week: weekPlan } = planWeek(byDay, dayTargets);
  const weekStatusLabel = planStatusLabel(weekPlan);
  // The two ranges a week can hold, for the "why do days differ" line. Every gym day carries
  // the same range, and so does every recovery day.
  const allPlans = DaysOfWeekValues.map(d => plans[d]);
  const gymPlan = allPlans.find(p => p.kind === 'gym');
  const recoveryPlan = allPlans.find(p => p.kind === 'recovery');

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
            label="Share menu"
            icon={<ShareOutlineIcon />}
            onClick={() => setShowShareModal(true)}
            variant="ghost"
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--accent)] hover:text-[var(--accent-hover)]"
          />
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
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--red)] hover:opacity-80"
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

      {showShareModal && (
        <ShareMenuModal menu={menu} gymDays={gymDays} gymTime={gymTime} onClose={() => setShowShareModal(false)} />
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

      {/* One week summary: planned kcal against the target, and how much of the plan is logged. */}
      {menu.meals.length > 0 && (
        <Card compact className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              Week plan vs. target
            </span>
            {weekStatusLabel && (
              <span className="text-xs font-semibold" style={{ color: weekPlan.color }}>
                {weekStatusLabel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold" style={{ color: weekPlan.color }}>
              {weekPlan.plannedKcal.toLocaleString()}
            </span>
            <span className="text-sm text-[var(--muted)]">
              kcal planned · {weekPlan.isEstimated ? 'estimated ' : ''}range{' '}
              {formatKcalRange(weekPlan.floor, weekPlan.ceiling)}
            </span>
          </div>
          <RangeBar
            plannedKcal={weekPlan.plannedKcal}
            floor={weekPlan.floor}
            ceiling={weekPlan.ceiling}
            color={weekPlan.color}
            size="md"
          />
          {daysWithMealsCount > 0 && (
            <div className="mt-1 flex items-center gap-3">
              <span className="shrink-0 text-xs text-[var(--muted)]">Adherence</span>
              <div className="h-1.5 flex-1 rounded-full bg-[var(--card3)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    adherencePct === 100 ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'
                  }`}
                  style={{ width: `${adherencePct}%` }}
                />
              </div>
              <span
                className={`shrink-0 text-xs font-semibold ${
                  adherencePct === 100 ? 'text-[var(--green)]' : 'text-[var(--text)]'
                }`}
              >
                {fullyLoggedDaysCount}/{daysWithMealsCount} days
              </span>
            </div>
          )}
          {gymPlan && recoveryPlan && !weekPlan.isEstimated && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <DumbbellIcon className="size-3.5 text-[var(--accent)]" />
                Gym days{' '}
                <span className="font-semibold text-[var(--text)]">
                  {formatKcalRange(gymPlan.floor, gymPlan.ceiling)}
                </span>{' '}
                kcal
              </span>
              <span>
                Recovery{' '}
                <span className="font-semibold text-[var(--text)]">
                  {formatKcalRange(recoveryPlan.floor, recoveryPlan.ceiling)}
                </span>{' '}
                kcal
              </span>
            </div>
          )}
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
            plan={plans[day]}
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
          plans={plans}
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
