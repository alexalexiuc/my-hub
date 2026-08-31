'use client';

import { useEffect, useState } from 'react';
import { Card, NavRow } from '@/components';
import { DaysOfWeekValues, DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek, GymTime, MealType } from '@my-hub/shared/constants';
import { DayJumpChips } from './DayJumpChips';
import { DayCard } from './DayCard';
import type { LoggedMeals } from './menu.utils';
import type { WeeklyMenuMeal } from './types';

type MobileDayViewProps = {
  weekStart: string;
  menuId: string;
  isCurrentWeek: boolean;
  today: string;
  byDay: Record<number, WeeklyMenuMeal[]>;
  todayIndex: DayOfWeek | undefined;
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
};

/**
 * Phone view of the week: one day's card at a time, picked via the day-chip row or the
 * prev/next-day arrows below — both drive the same selection and stay in sync. Replaces stacking
 * all seven cards (which the desktop grid still does) with paging through a single rendered day,
 * so an empty day costs nothing and no card is ever sized to match the fullest day of the week.
 */
export function MobileDayView({
  weekStart,
  menuId,
  isCurrentWeek,
  today,
  byDay,
  todayIndex,
  loggedMeals,
  gymDays,
  dailyTargetKcal,
  gymDayCalorieBonus,
  gymTime,
  onMealLogChanged,
  onMealSwapped,
  onMealAdded,
  onMealDeleted,
}: MobileDayViewProps) {
  // Non-null: `DaysOfWeekValues` is a static constant of all seven days, so index 0 (Monday)
  // always exists — the array type itself just can't express that.
  const monday = DaysOfWeekValues[0]!;
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayIndex ?? monday);

  // Re-sync when the menu changes (week navigation) — otherwise a day selected on one week (say,
  // Friday) could stay selected after jumping to a week where "today" no longer applies.
  useEffect(() => {
    setSelectedDay(todayIndex ?? monday);
  }, [menuId, todayIndex, monday]);

  function step(delta: 1 | -1) {
    const idx = DaysOfWeekValues.indexOf(selectedDay);
    const next = DaysOfWeekValues[idx + delta];
    if (next !== undefined) setSelectedDay(next);
  }
  const dayIdx = DaysOfWeekValues.indexOf(selectedDay);

  const mealCounts = Object.fromEntries(DaysOfWeekValues.map(d => [d, byDay[d]?.length ?? 0])) as Record<
    DayOfWeek,
    number
  >;

  return (
    <div className="flex flex-col gap-3">
      <DayJumpChips
        mealCounts={mealCounts}
        todayIndex={todayIndex}
        selectedDay={selectedDay}
        onSelect={setSelectedDay}
      />

      <NavRow
        prevLabel="Previous day"
        nextLabel="Next day"
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        prevDisabled={dayIdx === 0}
        nextDisabled={dayIdx === DaysOfWeekValues.length - 1}
        label={
          <span className="min-w-[100px] text-center text-sm font-medium text-[var(--text)]">
            {DAY_LABELS[selectedDay]}
          </span>
        }
      />

      <Card className="!p-0 -mx-4 overflow-hidden md:mx-0">
        <DayCard
          variant="flat"
          day={selectedDay}
          meals={byDay[selectedDay] ?? []}
          menuId={menuId}
          weekStart={weekStart}
          isCurrentWeek={isCurrentWeek}
          today={today}
          loggedMeals={loggedMeals}
          isGymDay={gymDays.includes(selectedDay)}
          dailyTargetKcal={dailyTargetKcal}
          gymDayCalorieBonus={gymDayCalorieBonus}
          gymTime={gymTime}
          onMealLogChanged={(mealType, logged) => onMealLogChanged(selectedDay, mealType, logged)}
          onMealSwapped={onMealSwapped}
          onMealAdded={onMealAdded}
          onMealDeleted={onMealDeleted}
        />
      </Card>
    </div>
  );
}
