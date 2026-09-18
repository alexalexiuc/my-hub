'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import Link from 'next/link';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import {
  dateToString,
  dayCalorieTargets,
  latestWeightKg,
  getCurrentWeekDays,
  shiftWeekStr,
  weekLabel,
} from '@my-hub/shared/utils';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';
import { currentWeekMonday } from '../menu/menu.utils';
import { GoalProgressCard } from '../GoalProgressCard';
import { WeeklyChart } from '../WeeklyChart';
import { WeightChart } from '../WeightChart';
import { MeasurementsSection } from '../MeasurementsSection';
import { PeriodNav } from '../ui';
import { shiftDate } from '../calories.utils';
import { DEFAULT_TREND_RANGE, WEIGHT_RANGE_OPTIONS, type WeightRangeKey } from '../constants';
import { mealEvents } from '../mealEvents';

export default function ProgressPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [weightHistory, setWeightHistory] = useState<MeasurementWithType[]>([]);
  const [weeklyMeals, setWeeklyMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Both weight charts read from one history fetch, so the range has to cover the wider of the
  // two. The goal card tops out at 12 weeks; the trend chart is what can ask for a year.
  const [trendRange, setTrendRange] = useState<WeightRangeKey>(DEFAULT_TREND_RANGE);

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
   *
   * The whole history is fetched once and windowed client-side rather than re-fetched per range.
   * Smoothing needs the readings *before* a window to enter it warm — a range-scoped fetch would
   * restart the trend at whatever the first day in view happened to read — and weigh-in rows are
   * small enough that one row per day for years is a cheaper payload than a refetch per chip.
   */
  const loadProfile = useCallback(async () => {
    try {
      const [profileData, weightData] = await Promise.all([
        apiFetch<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>('/api/calories/profile'),
        apiFetch<{ measurements: MeasurementWithType[] }>('/api/calories/measurements', {
          query: { type: 'weight', limit: 2000 },
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
  const today = dateToString(new Date());

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

  const weightSamples = weightHistory.map(m => ({ date: m.date, value: m.value }));

  const trendDays = WEIGHT_RANGE_OPTIONS.find(o => o.key === trendRange)?.days ?? null;
  const trendFrom = trendDays === null ? null : shiftDate(today, -trendDays);
  const trendSamples = trendFrom === null ? weightSamples : weightSamples.filter(s => s.date >= trendFrom);

  /**
   * Moves the goal baseline to today at the latest weigh-in, which is how a stalled or abandoned
   * run gets forgiven — deliberately, by the user, rather than silently every Monday.
   */
  const resetGoalBaseline = async () => {
    const latest = [...weightSamples].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return;
    await apiFetch('/api/calories/profile', {
      method: 'PUT',
      body: { goalStartDate: today, goalStartWeightKg: latest.value },
    });
    await loadProfile();
  };

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
        weightHistory={weightSamples}
        goalType={profile?.goalType ?? null}
        goalWeeklyRateKg={profile?.goalWeeklyRateKg ?? null}
        goalStartDate={profile?.goalStartDate ?? null}
        goalStartWeightKg={profile?.goalStartWeightKg ?? null}
        onResetBaseline={resetGoalBaseline}
        canReset={weightSamples.length > 0}
      />

      <WeightChart data={trendSamples} range={trendRange} onRangeChange={setTrendRange} />

      <MeasurementsSection
        latestMeasurements={latestMeasurements}
        measurementTypes={measurementTypeDefinitions}
        onChanged={loadProfile}
      />
    </main>
  );
}
