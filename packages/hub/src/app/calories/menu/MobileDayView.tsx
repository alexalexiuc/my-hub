'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components';
import { DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek, GymTime, MealType } from '@my-hub/shared/constants';
import { DayJumpChips } from './DayJumpChips';
import { DayCard } from './DayCard';
import type { DayPlan, LoggedMeals } from './menu.utils';
import type { WeeklyMenuMeal } from './types';

type MobileDayViewProps = {
  weekStart: string;
  menuId: string;
  isCurrentWeek: boolean;
  today: string;
  byDay: Record<number, WeeklyMenuMeal[]>;
  todayIndex: DayOfWeek | undefined;
  loggedMeals: LoggedMeals;
  /** Each day's plan against its own range, from `planWeek`. */
  plans: Record<DayOfWeek, DayPlan>;
  /** When the user trains — decides where the pre/post-workout meals sit in each day's order. */
  gymTime: GymTime | null;
  onMealLogChanged: (day: DayOfWeek, mealType: MealType, logged: boolean) => void;
  onMealSwapped: (day: DayOfWeek, updated: WeeklyMenuMeal) => void;
  onMealAdded: (day: DayOfWeek, added: WeeklyMenuMeal) => void;
  onMealDeleted: (day: DayOfWeek, mealType: MealType) => void;
};

/**
 * Phone view of the week: one day's card at a time, picked via the day-chip row. Replaces stacking
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
  plans,
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

  // The extra top padding and the wider gap keep the summary card, the chip row and the day card
  // reading as three blocks rather than one run of cards.
  return (
    <div className="flex flex-col gap-5 pt-2">
      <DayJumpChips plans={plans} todayIndex={todayIndex} selectedDay={selectedDay} onSelect={setSelectedDay} />

      <Card compact className="!p-0 overflow-hidden">
        <DayCard
          variant="flat"
          day={selectedDay}
          meals={byDay[selectedDay] ?? []}
          menuId={menuId}
          weekStart={weekStart}
          isCurrentWeek={isCurrentWeek}
          today={today}
          loggedMeals={loggedMeals}
          plan={plans[selectedDay]}
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
