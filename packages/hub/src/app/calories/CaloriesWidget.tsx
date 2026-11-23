'use client';

import { FeatureTheme } from '@/components';
import { useState } from 'react';
import {
  dateToString,
  calculateMacroKcal,
  dayCalorieTargets,
  latestWeightKg,
  shiftDateStr,
  summariseTargetAdherence,
} from '@my-hub/shared/utils';
import { SectionCard } from '@/components';
import { PlusOutlineIcon, ScaleIcon } from '@/components/icons';
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible';
import { CaloriesDonut } from './CaloriesDonut';
import { MealModal } from './MealModal';
import { MeasurementModal } from './MeasurementModal';
import { mealEvents } from './mealEvents';
import { sumMealTotals } from './calories.utils';
import { MACRO_COLORS, STREAK_LOOKBACK_DAYS } from './constants';
import { useCalendarDays } from './calendar/useCalendarDays';
import { useCalorieProfile } from './useCalorieProfile';
import { useMealsForDate } from './useMealsForDate';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';

function MacroBar({
  label,
  value,
  goal,
  sharePct,
  color,
}: {
  label: string;
  value: number;
  goal: number | null;
  sharePct: number;
  color: string;
}) {
  const reached = goal !== null && goal > 0 && value >= goal;
  const barPct = goal !== null && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : sharePct;
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
      {goal !== null && goal > 0 ? (
        <p className="text-sm font-semibold">
          {reached ? (
            <span className="text-[var(--green)]">✓</span>
          ) : (
            <>
              {value}
              <span className="text-xs font-normal text-[var(--muted)]">/{goal}g</span>
            </>
          )}
        </p>
      ) : (
        <p className="text-sm font-semibold">{value}g</p>
      )}
      <div className="mt-1 h-1 w-full rounded-full bg-[var(--card2)] overflow-hidden">
        {/* Inline colour: the macro palette is shared with the Today page's chart. */}
        <div
          className="h-full rounded-full"
          style={{ width: `${barPct}%`, backgroundColor: reached ? 'var(--green)' : color }}
        />
      </div>
    </div>
  );
}

export function CaloriesWidget() {
  const {
    profile,
    measurements,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
  } = useCalorieProfile();
  const today = dateToString(new Date());
  const { meals, error: mealsError } = useMealsForDate(today);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const { days: recentDays } = useCalendarDays({
    dateFrom: shiftDateStr(today, -(STREAK_LOOKBACK_DAYS - 1)),
    dateTo: today,
  });
  const streak = recentDays ? summariseTargetAdherence(recentDays, today, null).currentStreak : 0;

  // Meals logged by Claude while the dashboard sits open (the profile hook reloads itself);
  // `changed` also refreshes the streak. `today` is re-read on that render, so a dashboard left
  // open overnight moves on to the new day.
  useRefetchOnVisible(async () => {
    mealEvents.emit('changed');
  });

  const loading = profileLoading || (meals === null && mealsError === null);
  const failed = profileError !== null || (meals === null && mealsError !== null);

  const { kcal: todayKcal, protein, carbs, fat } = sumMealTotals(meals ?? []);
  // Same resolver as the Today tab and the weekly menu, gym-day bonus included.
  const { target: cap, min: minCalories } = dayCalorieTargets(profile, latestWeightKg(measurements), today);
  const macroGoals =
    profile?.goalProtein != null || profile?.goalCarbs != null || profile?.goalFat != null
      ? { protein: profile.goalProtein ?? 0, carbs: profile.goalCarbs ?? 0, fat: profile.goalFat ?? 0 }
      : null;

  const totalMacroKcal = calculateMacroKcal(protein, carbs, fat);
  const sharePct = (kcal: number) => (totalMacroKcal > 0 ? Math.round((kcal / totalMacroKcal) * 100) : 0);

  return (
    <FeatureTheme feature="calories">
      {showAddMeal && (
        <MealModal
          date={today}
          gymTime={profile?.gymTime ?? null}
          onClose={() => setShowAddMeal(false)}
          onSaved={() => {
            setShowAddMeal(false);
            mealEvents.emit('changed');
          }}
        />
      )}
      {showAddWeight && (
        <MeasurementModal
          measurementTypes={measurementTypeDefinitions}
          defaultTypeKey="weight"
          onClose={() => setShowAddWeight(false)}
          onSaved={() => {
            setShowAddWeight(false);
            void reloadProfile(true);
          }}
        />
      )}

      <SectionCard
        title="Calories"
        titleHref="/calories"
        titleHoverClass="hover:text-[var(--accent)]"
        className="border-[var(--border)] bg-linear-to-br from-[var(--card2)] to-[var(--card)]"
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAddWeight(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
              aria-label="Log weight"
              title="Log weight"
            >
              <ScaleIcon className="size-3" />
              Weight
            </button>
            <button
              onClick={() => setShowAddMeal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
              aria-label="Log meal"
              title="Log meal"
            >
              <PlusOutlineIcon className="size-3" />
              Add
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="mx-auto w-[140px] h-[140px] rounded-full bg-[var(--card2)]" />
            <div className="h-4 w-24 mx-auto bg-[var(--card2)] rounded-sm" />
            <div className="flex gap-4 pt-3 border-t border-[var(--border)]">
              <div className="flex-1 h-8 bg-[var(--card2)] rounded-sm" />
              <div className="flex-1 h-8 bg-[var(--card2)] rounded-sm" />
              <div className="flex-1 h-8 bg-[var(--card2)] rounded-sm" />
            </div>
          </div>
        ) : failed ? (
          // Not "No goal set": a failed load says nothing about the profile, and the link would
          // send the user to set up a profile they already have.
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            Couldn&apos;t load today&apos;s calories.{' '}
            <a href="/calories" className="underline underline-offset-2 hover:text-[var(--text)]">
              Open Calories
            </a>
          </p>
        ) : (
          <div className="flex flex-col items-center">
            <CaloriesDonut eaten={todayKcal} cap={cap} min={minCalories} innerRadius={45} />

            <p className="text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--text)]">{todayKcal}</span>
              {cap !== null && (
                <>
                  {' '}
                  <span className="text-[var(--subtle)]">/</span> <span>{cap}</span>
                </>
              )}{' '}
              kcal
            </p>
            {(minCalories !== null || cap !== null) && (
              // Red only past the ceiling. Below the floor is not flagged: the day is still in
              // progress, the same reason the seven-day strip leaves today's dot neutral.
              <p
                className={`text-xs mt-1 ${cap !== null && todayKcal > cap ? 'text-[var(--red)]' : 'text-[var(--muted)]'}`}
              >
                {minCalories !== null && cap !== null
                  ? `Target range: ${minCalories}-${cap} kcal`
                  : minCalories !== null
                    ? `Minimum target: ${minCalories} kcal`
                    : `Target: ${cap} kcal`}
              </p>
            )}
            {streak > 1 && (
              <p className="mt-1 text-xs font-semibold text-[var(--accent)]">{streak}-day streak on target</p>
            )}
            {cap === null && (
              <p className="text-xs text-[var(--muted)] mt-1">
                No goal set.{' '}
                <a
                  href="/calories/settings"
                  className="text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)]"
                >
                  Complete your profile
                </a>
                .
              </p>
            )}

            {/* Same order and colours as the Today page's macro chart. */}
            <div className="flex gap-4 w-full mt-4 pt-3 border-t border-[var(--border)]">
              <MacroBar
                label="Carbs"
                value={carbs}
                goal={macroGoals?.carbs ?? null}
                sharePct={sharePct(carbs * 4)}
                color={MACRO_COLORS.carbs}
              />
              <MacroBar
                label="Protein"
                value={protein}
                goal={macroGoals?.protein ?? null}
                sharePct={sharePct(protein * 4)}
                color={MACRO_COLORS.protein}
              />
              <MacroBar
                label="Fat"
                value={fat}
                goal={macroGoals?.fat ?? null}
                sharePct={sharePct(fat * 9)}
                color={MACRO_COLORS.fat}
              />
            </div>
          </div>
        )}
      </SectionCard>
    </FeatureTheme>
  );
}
