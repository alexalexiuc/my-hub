'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import Link from 'next/link';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets, dateToString, getCurrentWeekDays } from '@my-hub/shared/utils';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';
import { GoalProgressCard } from '../GoalProgressCard';
import { WeeklyChart } from '../WeeklyChart';
import { WeightChart } from '../WeightChart';
import { MeasurementsSection } from '../MeasurementsSection';
import { mealEvents } from '../mealEvents';

export default function ProgressPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [weightHistory, setWeightHistory] = useState<MeasurementWithType[]>([]);
  const [weeklyMeals, setWeeklyMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = dateToString(new Date());
  const weekDays = getCurrentWeekDays();
  const weekStart = weekDays[0]!.date;

  const loadData = useCallback(async () => {
    try {
      const [profileData, weightData, weeklyData] = await Promise.all([
        apiFetch<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>('/api/calories/profile'),
        apiFetch<{ measurements: MeasurementWithType[] }>('/api/calories/measurements', {
          query: { type: 'weight', limit: 30 },
        }),
        apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { dateFrom: weekStart, dateTo: today } }),
      ]);
      setProfile(profileData.profile);
      setLatestMeasurements(profileData.measurements);
      setWeightHistory(weightData.measurements);
      setWeeklyMeals(weeklyData.meals);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Not signed in' : String(e));
    } finally {
      setLoading(false);
    }
  }, [today, weekStart]);

  const loadWeeklyMeals = useCallback(async () => {
    try {
      const data = await apiFetch<{ meals: MealLog[] }>('/api/calories/meals', {
        query: { dateFrom: weekStart, dateTo: today },
      });
      setWeeklyMeals(data.meals);
    } catch {
      // ignore — stale weekly totals are acceptable on a silent refresh
    }
  }, [today, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const calorieTargets = calculateCalorieTargets({
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: latestMeasurements.find(m => m.typeKey === 'weight')?.value ?? null,
    activityLevel: profile?.activityLevel ?? null,
    goalType: profile?.goalType ?? null,
    goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? null,
    goalMinCalories: profile?.goalMinCalories ?? null,
    goalMaxCalories: profile?.goalMaxCalories ?? null,
  });

  const weeklyData = weekDays.map(({ date, label }) => {
    const dayMeals = weeklyMeals.filter(m => m.date === date);
    return { date, label, kcal: dayMeals.reduce((sum, m) => sum + (m.kcal ?? 0), 0) };
  });

  const weightChartData = weightHistory
    .filter(m => m.typeKey === 'weight')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20)
    .map(m => ({ date: m.date, label: m.date.slice(5), value: m.value }));

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <WeeklyChart
        data={weeklyData}
        target={calorieTargets.goalCalories ?? null}
        min={calorieTargets.minCalories ?? null}
        max={calorieTargets.maxCalories ?? null}
      />

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
        onChanged={loadData}
      />
    </main>
  );
}
