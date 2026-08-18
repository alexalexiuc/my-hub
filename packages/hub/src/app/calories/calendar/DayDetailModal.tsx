'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Modal } from '@/components';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MealType, GymTime } from '@my-hub/shared/constants';
import { dateToString, mealOrder } from '@my-hub/shared/utils';
import { MEAL_LABEL } from '../constants';
import { formatDateLabel, groupByMealType } from '../calories.utils';
import { targetPct, targetColorClasses } from '../menu/menu.utils';
import { TargetBar } from '../menu/TargetBar';
import { MacroChart } from '../MacroChart';
import { MealRow } from '../menu/MealRow';
import { mealEvents } from '../mealEvents';
import type { WeeklyMenuMeal } from '../menu/types';
import type { CalendarDay } from './types';

type PlannedMeal = WeeklyMenuMeal & { logged: boolean };

type DayDetailModalProps = {
  date: string;
  /** Already fetched by the month grid — avoids re-requesting the same totals per click. */
  summary?: CalendarDay;
  onClose: () => void;
};

/**
 * kcal + macros + logged/planned meals for one day, opened from a calendar cell. The logged
 * section is a read-only summary of the calorie journal, but planned menu items reuse `MealRow` —
 * the same row the Weekly Menu tab renders — so this modal gets log/edit/delete for free and
 * never drifts from how a planned meal looks and behaves everywhere else.
 */
export function DayDetailModal({ date, summary, onClose }: DayDetailModalProps) {
  const today = dateToString(new Date());
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [gymTime, setGymTime] = useState<GymTime | null>(null);
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped after a mutation inside the modal (log/edit/delete via MealRow) to re-run the
  // day-scoped fetch below without needing a stable function identity to key an effect on.
  const [reloadKey, setReloadKey] = useState(0);

  // The profile (goals/macro targets) doesn't change when a meal is logged, so it's fetched once
  // on mount rather than on every reload below — logging/editing/deleting a meal has no reason to
  // re-request it.
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ profile: CalorieProfile | null }>('/api/calories/profile', { silentToast: true }).then(data => {
      if (!cancelled) setProfile(data.profile);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date }, silentToast: true }),
      apiFetch<{ menuId: string | null; meals: PlannedMeal[]; gymTime: GymTime | null }>('/api/calories/menu/today', {
        query: { date },
        silentToast: true,
      }),
    ])
      .then(([mealsData, planData]) => {
        if (cancelled) return;
        setMeals(mealsData.meals);
        setMenuId(planData.menuId);
        setPlannedMeals(planData.meals);
        setGymTime(planData.gymTime);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  /**
   * Logging/editing/deleting a planned meal here also touches the calorie journal (log-day
   * writes both in one transaction) and this day's kcal/macro totals, which the modal doesn't
   * own — they come in as the `summary` prop from the month grid. Bumping `reloadKey` (re-running
   * the day-scoped fetch above) and re-emitting `mealEvents` (the feature's cross-widget refresh
   * signal, which the month grid listens for) keeps both the "Logged" list here and the grid's
   * totals/badge in step with a single source of truth, instead of hand-patching local state to
   * match what the server just did.
   */
  function handleMealChanged() {
    setReloadKey(k => k + 1);
    mealEvents.emit('changed');
  }

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

            {orderedPlanned.length > 0 && menuId && (
              <section className="flex flex-col gap-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">Planned menu</h3>
                {orderedPlanned.map(meal => (
                  <MealRow
                    key={meal.mealType}
                    meal={meal}
                    menuId={menuId}
                    dayOfWeek={meal.dayOfWeek}
                    dayDate={date}
                    today={today}
                    logged={meal.logged}
                    onLogChanged={handleMealChanged}
                    onSwapped={handleMealChanged}
                    onDeleted={handleMealChanged}
                  />
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
