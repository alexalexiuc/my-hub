'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import Link from 'next/link';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { dayCalorieTargets, latestWeightKg, getCurrentWeekDays, shiftWeekStr, weekLabel } from '@my-hub/shared/utils';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';
import { currentWeekMonday } from '../menu/menu.utils';
import { GoalProgressCard } from '../GoalProgressCard';
import { WeeklyChart } from '../WeeklyChart';
import { WeightChart } from '../WeightChart';
import { MeasurementsSection } from '../MeasurementsSection';
import { PeriodNav } from '../ui';
import { shiftDate } from '../calories.utils';
import { mealEvents } from '../mealEvents';

export default function ProgressPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [weightHistory, setWeightHistory] = useState<MeasurementWithType[]>([]);
  const [weeklyMeals, setWeeklyMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const thisWeekStart = currentWeekMonday();
  // The week on screen. Previously pinned to the current week with no way to look back, so a
  // finished week became unreachable the moment Monday arrived.
  const [weekStart, setWeekStart] = useState(thisWeekStart);
  const isCurrentWeek = weekStart === thisWeekStart;
  const weekEnd = shiftDate(weekStart, 6);
  // `weekLabel` reads UTC components, so it needs a UTC-midnight date. Parsing the same string at
  // local midnight puts a positive-offset timezone on the previous UTC day — and therefore in the
  // previous ISO week, which labelled the week before this one as two weeks back.
  const weekStartUtc = new Date(`${weekStart}T00:00:00Z`);

  const weekDays = useMemo(() => getCurrentWeekDays(weekStart), [weekStart]);

  /**
   * Profile and weight history, which describe the user rather than the week on screen. Kept out
   * of the week-dependent loader so paging back through months doesn't refetch them per arrow.
   */
  const loadProfile = useCallback(async () => {
    try {
      const [profileData, weightData] = await Promise.all([
        apiFetch<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>('/api/calories/profile'),
        apiFetch<{ measurements: MeasurementWithType[] }>('/api/calories/measurements', {
          query: { type: 'weight', limit: 30 },
        }),
      ]);
      setProfile(profileData.profile);
      setLatestMeasurements(profileData.measurements);
      setWeightHistory(weightData.measurements);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Not signed in' : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeeklyMeals = useCallback(async () => {
    try {
      const data = await apiFetch<{ meals: MealLog[] }>('/api/calories/meals', {
        query: { dateFrom: weekStart, dateTo: weekEnd },
      });
      setWeeklyMeals(data.meals);
    } catch {
      // ignore — stale weekly totals are acceptable on a silent refresh
    }
  }, [weekEnd, weekStart]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadWeeklyMeals();
  }, [loadWeeklyMeals]);

  useEffect(() => {
    mealEvents.on('changed', loadWeeklyMeals);
    return () => mealEvents.off('changed', loadWeeklyMeals);
  }, [loadWeeklyMeals]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 py-6">
        <div className="text-[var(--muted)]">Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 py-6">
        <p className="text-[var(--red)]">{error}</p>
        {error === 'Not signed in' && (
          <Link href="/auth/signin" className="mt-2 inline-block text-[var(--accent)] underline">
            Sign in
          </Link>
        )}
      </main>
    );
  }

  const weightKg = latestWeightKg(latestMeasurements);

  // Targets are resolved per day so training days carry their bonus, matching the weekly menu
  // and the Today page rather than judging every day against one flat number.
  const weeklyData = weekDays.map(({ date, label }) => {
    const { target, min } = dayCalorieTargets(profile, weightKg, date);
    return {
      date,
      label,
      kcal: weeklyMeals.filter(m => m.date === date).reduce((sum, m) => sum + (m.kcal ?? 0), 0),
      target,
      min,
    };
  });

  // Copied before sorting: `sort` is in-place, and this array is React state that the API hands
  // over newest-first — reordering it here would silently flip the order every other reader sees.
  const weightChartData = [...weightHistory]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20)
    .map(m => ({ date: m.date, label: m.date.slice(5), value: m.value }));

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <PeriodNav
        compact
        label={isCurrentWeek ? 'This week' : weekLabel(weekStartUtc)}
        isCurrent={isCurrentWeek}
        onPrev={() => setWeekStart(shiftWeekStr(weekStart, -1))}
        onNext={() => setWeekStart(shiftWeekStr(weekStart, 1))}
      />

      <WeeklyChart data={weeklyData} />

      <GoalProgressCard
        days={weekDays}
        weightHistory={weightHistory}
        goalType={profile?.goalType ?? null}
        goalWeeklyRateKg={profile?.goalWeeklyRateKg ?? null}
      />

      <WeightChart data={weightChartData} />

      <MeasurementsSection
        latestMeasurements={latestMeasurements}
        measurementTypes={measurementTypeDefinitions}
        onChanged={loadProfile}
      />
    </main>
  );
}
