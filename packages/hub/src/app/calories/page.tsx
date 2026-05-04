'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import Link from 'next/link';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets, dateToString, getCurrentWeekDays } from '@my-hub/shared/utils';
import { IconButton, PageHeader } from '@/components';
import { BarChartIcon, CalendarIcon } from '@/components/icons';
import { GoalProgressCard } from './GoalProgressCard';
import { MacroChart } from './MacroChart';
import { MealsSection } from './MealsSection';
import { MeasurementsSection } from './MeasurementsSection';
import { AutomationApiSection } from './AutomationApiSection';
import { ProfileCard } from './ProfileCard';
import { WeeklyChart } from './WeeklyChart';
import { WeightChart } from './WeightChart';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';

export default function CaloriesDashboardPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [weeklyMeals, setWeeklyMeals] = useState<MealLog[]>([]);
  const [weightHistory, setWeightHistory] = useState<MeasurementWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = dateToString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedDateRef = useRef(selectedDate);
  const weekDays = getCurrentWeekDays();
  const weekStart = weekDays[0]!.date;

  const loadMeals = useCallback(async (date: string) => {
    try {
      const data = await apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date, limit: 100 } });
      // Only apply if this is still the selected date (avoid race)
      if (selectedDateRef.current === date) {
        setMeals(data.meals);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = selectedDateRef.current;
      const [profileData, mealsData, weeklyData, weightData] = await Promise.all([
        apiFetch<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>('/api/calories/profile'),
        apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date, limit: 100 } }),
        apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { dateFrom: weekStart, dateTo: today } }),
        apiFetch<{ measurements: MeasurementWithType[] }>('/api/calories/measurements', {
          query: { type: 'weight', limit: 30 },
        }),
      ]);

      setProfile(profileData.profile);
      setLatestMeasurements(profileData.measurements);
      if (selectedDateRef.current === date) {
        setMeals(mealsData.meals);
      }
      setWeeklyMeals(weeklyData.meals);
      setWeightHistory(weightData.measurements);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Not signed in' : String(e));
    } finally {
      setLoading(false);
    }
  }, [today, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      selectedDateRef.current = date;
      setMeals([]); // clear stale data immediately
      loadMeals(date);
    },
    [loadMeals],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <div className="text-zinc-400">Loading...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="text-red-500">{error}</p>
        {error === 'Not signed in' && (
          <Link href="/auth/signin" className="mt-2 inline-block text-indigo-400 underline">
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

  const todayProtein = Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0));
  const todayCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0));
  const todayFat = Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0));

  // Weekly chart data
  const weeklyData = weekDays.map(({ date, label }) => {
    const dayMeals = weeklyMeals.filter(m => m.date === date);
    return { date, label, kcal: dayMeals.reduce((sum, m) => sum + (m.kcal ?? 0), 0) };
  });

  // Weight chart data
  const weightChartData = weightHistory
    .filter(m => m.typeKey === 'weight')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20)
    .map(m => ({
      date: m.date,
      label: m.date.slice(5), // MM-DD
      value: m.value,
    }));

  const reportActions = (
    <>
      <IconButton href="/calories/reports/weekly" label="Weekly Reports" icon={<BarChartIcon />} />
      <IconButton href="/calories/reports/monthly" label="Monthly Reports" icon={<CalendarIcon />} />
    </>
  );

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <PageHeader title="Calories" backHref="/" backLabel="← Home" actions={reportActions} />

      {/* Meals + calorie consumption (merged, with expandable meals list) */}
      <MealsSection
        meals={meals}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onChanged={loadData}
        goalCalories={calorieTargets.goalCalories}
        maxCalories={calorieTargets.maxCalories}
      />

      {/* Macro split — second card */}
      <MacroChart
        protein={todayProtein}
        carbs={todayCarbs}
        fat={todayFat}
        goalProtein={profile?.goalProtein ?? null}
        goalCarbs={profile?.goalCarbs ?? null}
        goalFat={profile?.goalFat ?? null}
      />

      {/* Weekly chart */}
      <WeeklyChart
        data={weeklyData}
        target={calorieTargets.goalCalories ?? null}
        min={calorieTargets.minCalories ?? null}
        max={calorieTargets.maxCalories ?? null}
      />

      {/* Goal progress */}
      <GoalProgressCard
        days={weekDays}
        weightHistory={weightHistory}
        goalType={profile?.goalType ?? null}
        goalWeeklyRateKg={profile?.goalWeeklyRateKg ?? null}
      />

      {/* Weight trend (shown when enough data) */}
      <WeightChart data={weightChartData} />

      {/* Measurements */}
      <MeasurementsSection
        latestMeasurements={latestMeasurements}
        measurementTypes={measurementTypeDefinitions}
        onChanged={loadData}
      />

      {/* Settings (profile) — at the bottom */}
      <ProfileCard profile={profile} latestMeasurements={latestMeasurements} onUpdated={loadData} />

      {/* Automation API key management */}
      {profile && <AutomationApiSection userId={profile.userId} initialKey={profile.automationApiKey} />}
    </main>
  );
}
