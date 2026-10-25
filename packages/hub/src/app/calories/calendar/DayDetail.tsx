'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/utils';
import { Card } from '@/components';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MealType, GymTime } from '@my-hub/shared/constants';
import { DayTargetStatuses, type DayTargetStatus } from '@my-hub/shared/constants';
import { dateToString, dayTargetStatus, mealOrder } from '@my-hub/shared/utils';
import { dayStatusColor, formatDateLabel } from '../calories.utils';
import { targetPct } from '../menu/menu.utils';
import { TargetBar } from '../menu/TargetBar';
import { MacroChart } from '../MacroChart';
import { MealRow } from '../menu/MealRow';
import { MealsSection } from '../MealsSection';
import { relogMeals } from '../relogMeals';
import { mealEvents } from '../mealEvents';
import type { WeeklyMenuMeal } from '../menu/types';
import type { CalendarDay } from './types';

const STATUS_BAR: Record<DayTargetStatus, { text: string; bg: string }> = {
  [DayTargetStatuses.OnTarget]: { text: 'text-[var(--green)]', bg: 'bg-[var(--green)]' },
  [DayTargetStatuses.Over]: { text: 'text-[var(--red)]', bg: 'bg-[var(--red)]' },
  [DayTargetStatuses.Under]: { text: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]' },
  [DayTargetStatuses.NotLogged]: { text: 'text-[var(--muted)]', bg: 'bg-[var(--muted)]' },
  [DayTargetStatuses.NoTarget]: { text: 'text-[var(--muted)]', bg: 'bg-[var(--muted)]' },
};

const IN_PROGRESS_BAR = { text: 'text-[var(--text)]', bg: 'bg-[var(--subtle)]' };

type PlannedMeal = WeeklyMenuMeal & { logged: boolean };

type DayDetailProps = {
  date: string;
  /** Already fetched by the month grid — avoids re-requesting the same totals per click. */
  summary?: CalendarDay;
  profile: CalorieProfile | null;
};

const STATUS_LABEL: Record<string, string> = {
  [DayTargetStatuses.OnTarget]: 'On target',
  [DayTargetStatuses.Over]: 'Over target',
  [DayTargetStatuses.Under]: 'Under minimum',
  [DayTargetStatuses.NotLogged]: 'Nothing logged',
  [DayTargetStatuses.NoTarget]: 'No target set',
};

/**
 * One day of the month grid, shown in a modal when its cell is tapped: its verdict, totals and macros, the logged meals (editable, with
 * "Add meal" so a forgotten meal can still be filed on the right day) and the weekly menu's plan.
 * Planned items reuse `MealRow` — the row the Weekly Menu renders — so log/edit/delete behave the
 * same here as there.
 */
export function DayDetail({ date, summary, profile }: DayDetailProps) {
  const today = dateToString(new Date());
  const isFuture = date > today;
  const isToday = date === today;
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [gymTime, setGymTime] = useState<GymTime | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped after a mutation here to re-run the day-scoped fetch below.
  const [reloadKey, setReloadKey] = useState(0);
  const [relogging, setRelogging] = useState(false);
  const [relogNote, setRelogNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date, limit: 100 }, silentToast: true }),
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
   * A change here also moves this day's totals in the month grid, which owns them. Re-fetching
   * the day and re-emitting `mealEvents` (the grid listens) keeps both on the server's numbers.
   */
  function handleChanged() {
    setReloadKey(k => k + 1);
    mealEvents.emit('changed');
  }

  /** Copies this past day's meals onto today — for the days you eat the same as some day before. */
  async function relogToToday() {
    setRelogging(true);
    try {
      await relogMeals(meals, today);
      setRelogNote(`Logged ${meals.length} meal${meals.length === 1 ? '' : 's'} to today.`);
      mealEvents.emit('changed');
    } finally {
      setRelogging(false);
    }
  }

  const kcal = summary?.kcal ?? 0;
  const target = summary?.target ?? null;
  const pct = targetPct(kcal, target);
  const status = summary ? dayTargetStatus(summary) : DayTargetStatuses.NotLogged;
  // Coloured by the same verdict as the grid cell above it, so the two never disagree. Today has
  // no verdict yet: half the target at lunchtime is progress, not a red "under".
  const colors = isToday ? IN_PROGRESS_BAR : STATUS_BAR[status];

  const order = mealOrder(gymTime);
  const orderIndex = (mt: MealType) => {
    const i = order.indexOf(mt);
    return i === -1 ? order.length : i;
  };
  const orderedPlanned = [...plannedMeals].sort((a, b) => orderIndex(a.mealType) - orderIndex(b.mealType));

  return (
    <section className="flex flex-col gap-3" aria-label={`Details for ${formatDateLabel(date)}`}>
      <Card compact className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* The date itself is the modal's title. */}
            {summary?.isGymDay && <p className="text-xs font-semibold text-[var(--accent)]">Gym day</p>}
            {target !== null && !isFuture && (
              <p className="text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--text)]">{Math.round(kcal).toLocaleString()}</span> of{' '}
                {target.toLocaleString()} kcal
              </p>
            )}
          </div>
          {!isFuture && (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={
                isToday
                  ? { color: 'var(--muted)', backgroundColor: 'var(--card3)' }
                  : { color: dayStatusColor(status), backgroundColor: 'var(--card2)' }
              }
            >
              {isToday ? 'In progress' : STATUS_LABEL[status]}
            </span>
          )}
        </div>
        {target !== null && !isFuture && <TargetBar pct={pct} colors={colors} size="sm" />}
        {!isFuture && (summary?.mealCount ?? 0) > 0 && (
          <MacroChart
            protein={Math.round(summary?.protein ?? 0)}
            carbs={Math.round(summary?.carbs ?? 0)}
            fat={Math.round(summary?.fat ?? 0)}
            goalProtein={profile?.goalProtein ?? null}
            goalCarbs={profile?.goalCarbs ?? null}
            goalFat={profile?.goalFat ?? null}
            compact
          />
        )}
        {isToday && (
          <Link href="/calories" className="text-xs text-[var(--accent)] underline-offset-2 hover:underline">
            Go to Today →
          </Link>
        )}
        {date < today && meals.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void relogToToday()}
              disabled={relogging || relogNote !== null}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              {relogging ? 'Logging…' : 'Log this day again today'}
            </button>
            {relogNote && (
              <Link href="/calories" className="text-xs text-[var(--accent)] underline-offset-2 hover:underline">
                {relogNote} See Today →
              </Link>
            )}
          </div>
        )}
      </Card>

      {loading ? (
        <p className="text-xs text-[var(--muted)]">Loading…</p>
      ) : (
        <>
          {!isFuture && (
            <MealsSection
              meals={meals}
              selectedDate={date}
              gymTime={gymTime}
              onChanged={handleChanged}
              showAdd
              compact
            />
          )}

          {orderedPlanned.length > 0 && menuId ? (
            <Card compact className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Planned menu</h3>
                <Link href="/calories/menu" className="text-[11px] text-[var(--subtle)] hover:text-[var(--accent)]">
                  Weekly menu →
                </Link>
              </div>
              {orderedPlanned.map(meal => (
                <MealRow
                  key={meal.mealType}
                  meal={meal}
                  menuId={menuId}
                  dayOfWeek={meal.dayOfWeek}
                  dayDate={date}
                  today={today}
                  logged={meal.logged}
                  onLogChanged={handleChanged}
                  onSwapped={handleChanged}
                  onDeleted={handleChanged}
                />
              ))}
            </Card>
          ) : (
            isFuture && (
              <Card compact className="flex items-center justify-between gap-3 p-4">
                <span className="text-sm text-[var(--subtle)]">Nothing planned for this day yet.</span>
                <Link href="/calories/menu" className="text-sm text-[var(--accent)] hover:underline">
                  Plan the week →
                </Link>
              </Card>
            )
          )}
        </>
      )}
    </section>
  );
}
