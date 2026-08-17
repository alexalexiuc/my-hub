'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Modal } from '@/components';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MealType, GymTime } from '@my-hub/shared/constants';
import { mealOrder } from '@my-hub/shared/utils';
import { MEAL_LABEL } from '../constants';
import { formatDateLabel, groupByMealType } from '../calories.utils';
import { targetPct, targetColorClasses } from '../menu/menu.utils';
import { TargetBar } from '../menu/TargetBar';
import { MacroChart } from '../MacroChart';
import type { CalendarDay } from './types';

type PlannedMeal = {
  mealType: MealType;
  description: string;
  kcal: number | null;
  logged: boolean;
};

type DayDetailModalProps = {
  date: string;
  /** Already fetched by the month grid — avoids re-requesting the same totals per click. */
  summary?: CalendarDay;
  onClose: () => void;
};

/** kcal + macros + logged/planned meals for one day, opened from a calendar cell. Read-only. */
export function DayDetailModal({ date, summary, onClose }: DayDetailModalProps) {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [gymTime, setGymTime] = useState<GymTime | null>(null);
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date }, silentToast: true }),
      apiFetch<{ menuId: string | null; meals: PlannedMeal[]; gymTime: GymTime | null }>('/api/calories/menu/today', {
        query: { date },
        silentToast: true,
      }),
      apiFetch<{ profile: CalorieProfile | null }>('/api/calories/profile', { silentToast: true }),
    ])
      .then(([mealsData, planData, profileData]) => {
        if (cancelled) return;
        setMeals(mealsData.meals);
        setPlannedMeals(planData.meals);
        setGymTime(planData.gymTime);
        setProfile(profileData.profile);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const kcal = summary?.kcal ?? 0;
  const target = summary?.target ?? null;
  const pct = targetPct(kcal, target);
  const colors = targetColorClasses(pct);

  // Same ordering rule as every other meal-slot list in the feature (FR-31), so pre-workout
  // doesn't render after dinner for a morning trainer here while it doesn't everywhere else.
  const order = mealOrder(gymTime);
  const orderIndex = (mt: MealType) => {
    const i = order.indexOf(mt);
    return i === -1 ? order.length : i;
  };
  const groupedMeals = groupByMealType(meals);
  const orderedMealGroups = order.filter(t => groupedMeals[t]?.length).map(t => [t, groupedMeals[t]!] as const);
  const orderedPlanned = [...plannedMeals].sort((a, b) => orderIndex(a.mealType) - orderIndex(b.mealType));

  return (
    <Modal title={formatDateLabel(date)} onClose={onClose} className="md:max-w-[420px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--text)]">{Math.round(kcal)} kcal</span>
            {target !== null && (
              <span className="text-[var(--muted)]">
                of {target}
                {summary?.isGymDay ? ' (gym)' : ''}
              </span>
            )}
          </div>
          {target !== null && <TargetBar pct={pct} colors={colors} size="sm" />}
        </div>

        <MacroChart
          protein={Math.round(summary?.protein ?? 0)}
          carbs={Math.round(summary?.carbs ?? 0)}
          fat={Math.round(summary?.fat ?? 0)}
          goalProtein={profile?.goalProtein ?? null}
          goalCarbs={profile?.goalCarbs ?? null}
          goalFat={profile?.goalFat ?? null}
          compact
        />

        {loading ? (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            {orderedMealGroups.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">Logged</h3>
                {orderedMealGroups.map(([mealType, group]) => (
                  <div key={mealType} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {MEAL_LABEL[mealType]}
                    </span>
                    <div className="flex flex-col gap-1">
                      {group.map(meal => (
                        <div
                          key={meal.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card2)] px-2.5 py-2 text-xs"
                        >
                          <span className="text-[var(--text)]">{meal.description}</span>
                          {meal.kcal !== null && (
                            <span className="shrink-0 pl-2 text-[var(--muted)]">{meal.kcal} kcal</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {orderedPlanned.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">Planned menu</h3>
                {orderedPlanned.map(meal => (
                  <div
                    key={meal.mealType}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card2)] px-2.5 py-2 text-xs"
                  >
                    <div className="flex flex-col">
                      <span className={meal.logged ? 'text-[var(--text)]' : 'text-[var(--muted)]'}>
                        {meal.description}
                      </span>
                      <span className="text-[10px] text-[var(--subtle)]">{MEAL_LABEL[meal.mealType]}</span>
                    </div>
                    <span className={meal.logged ? 'text-[var(--green)]' : 'text-[var(--subtle)]'}>
                      {meal.logged ? '✓ logged' : meal.kcal ? `${meal.kcal} kcal` : ''}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {orderedMealGroups.length === 0 && orderedPlanned.length === 0 && (
              <p className="text-xs text-[var(--subtle)] italic">Nothing logged or planned for this day.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
