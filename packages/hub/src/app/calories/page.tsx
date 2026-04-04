'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { CalorieProfile, MealLog, MeasurementType, User } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets, dateToString } from '@my-hub/shared/utils';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { BarChartIcon, CalendarIcon } from '@/components/icons';
import { GoalProgressCard } from './GoalProgressCard';
import { MacroChart } from './MacroChart';
import { MealsSection } from './MealsSection';
import { MeasurementsSection } from './MeasurementsSection';
import { ProfileCard } from './ProfileCard';
import { WeeklyChart } from './WeeklyChart';
import { WeightChart } from './WeightChart';

function getCurrentWeekDays(): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const today = new Date();
  const todayDay = today.getDay(); // Sun=0 ... Sat=6
  const daysSinceMonday = (todayDay + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);

  const cursor = new Date(monday);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(cursor);
    days.push({
      date: dateToString(d),
      label: d.toDateString() === today.toDateString() ? 'Today' : dayNames[(d.getDay() + 6) % 7]!,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export default function CaloriesDashboardPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [userProfile, setUserProfile] = useState<Pick<User, 'country' | 'timezone'> | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [weeklyMeals, setWeeklyMeals] = useState<MealLog[]>([]);
  const [weightHistory, setWeightHistory] = useState<MeasurementWithType[]>([]);
  const [measurementTypes, setMeasurementTypes] = useState<MeasurementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = dateToString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedDateRef = useRef(selectedDate);
  const weekDays = getCurrentWeekDays();
  const weekStart = weekDays[0]!.date;

  const loadMeals = useCallback(async (date: string) => {
    const res = await fetch(`/api/calories/meals?date=${date}&limit=100`);
    if (res.ok) {
      const data = (await res.json()) as { meals: MealLog[] };
      // Only apply if this is still the selected date (avoid race)
      if (selectedDateRef.current === date) {
        setMeals(data.meals);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = selectedDateRef.current;
      const [profileRes, mealsRes, typesRes, weeklyRes, weightRes, userProfileRes] = await Promise.all([
        fetch('/api/calories/profile'),
        fetch(`/api/calories/meals?date=${date}&limit=100`),
        fetch('/api/calories/measurement-types'),
        fetch(`/api/calories/meals?dateFrom=${weekStart}&dateTo=${today}`),
        fetch('/api/calories/measurements?type=weight&limit=30'),
        fetch('/api/users/profile'),
      ]);

      if (profileRes.status === 401 || mealsRes.status === 401) {
        setError('Not signed in');
        return;
      }

      const [profileData, mealsData, typesData, weeklyData, weightData, userProfileData] = await Promise.all([
        profileRes.json() as Promise<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>,
        mealsRes.json() as Promise<{ meals: MealLog[] }>,
        typesRes.json() as Promise<{ types: MeasurementType[] }>,
        weeklyRes.json() as Promise<{ meals: MealLog[] }>,
        weightRes.json() as Promise<{ measurements: MeasurementWithType[] }>,
        userProfileRes.ok
          ? (userProfileRes.json() as Promise<{ user: Pick<User, 'country' | 'timezone'> }>)
          : Promise.resolve({ user: null }),
      ]);

      setProfile(profileData.profile);
      setUserProfile(userProfileData.user);
      setLatestMeasurements(profileData.measurements);
      if (selectedDateRef.current === date) {
        setMeals(mealsData.meals);
      }
      setMeasurementTypes(typesData.types);
      setWeeklyMeals(weeklyData.meals);
      setWeightHistory(weightData.measurements);
    } catch (e) {
      setError(String(e));
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
    weightKg: latestMeasurements.find((m) => m.typeKey === 'weight')?.value ?? null,
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
    const dayMeals = weeklyMeals.filter((m) => m.date === date);
    return { date, label, kcal: dayMeals.reduce((sum, m) => sum + (m.kcal ?? 0), 0) };
  });

  // Weight chart data
  const weightChartData = weightHistory
    .filter((m) => m.typeKey === 'weight')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20)
    .map((m) => ({
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
      <MacroChart protein={todayProtein} carbs={todayCarbs} fat={todayFat} />

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
        measurementTypes={measurementTypes}
        onChanged={loadData}
      />

      {/* Settings (profile) — at the bottom */}
      <ProfileCard
        profile={profile}
        userProfile={userProfile}
        latestMeasurements={latestMeasurements}
        onUpdated={loadData}
      />
    </main>
  );
}
