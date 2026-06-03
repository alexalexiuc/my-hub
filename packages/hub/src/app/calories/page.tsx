'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import Link from 'next/link';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets, dateToString } from '@my-hub/shared/utils';
import { Card, DatePicker } from '@/components';
import { mealEvents } from './mealEvents';
import { MealsSection } from './MealsSection';
import { MacroChart } from './MacroChart';
import { CaloriesDonut } from './CaloriesDonut';

export default function TodayPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = dateToString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedDateRef = useRef(selectedDate);

  const loadMeals = useCallback(async (date: string) => {
    try {
      const data = await apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date, limit: 100 } });
      if (selectedDateRef.current === date) setMeals(data.meals);
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const date = selectedDateRef.current;
      const [profileData, mealsData] = await Promise.all([
        apiFetch<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>('/api/calories/profile'),
        apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date, limit: 100 } }),
      ]);
      setProfile(profileData.profile);
      setLatestMeasurements(profileData.measurements);
      if (selectedDateRef.current === date) setMeals(mealsData.meals);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Not signed in' : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    const handler = () => loadMeals(selectedDateRef.current);
    mealEvents.on('changed', handler);
    return () => mealEvents.off('changed', handler);
  }, [loadMeals]);

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      selectedDateRef.current = date;
      setMeals([]);
      loadMeals(date);
    },
    [loadMeals],
  );

  if (loading) {
    return (
      <main className="py-6">
        <div className="text-[var(--muted)]">Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="py-6">
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

  const cap = (calorieTargets.maxCalories ?? calorieTargets.goalCalories) || null;
  const totalKcal = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const totalProtein = Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0));
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0));
  const totalFat = Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0));

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  return (
    <main>
      {/* Greeting + date picker — outside any card, top-left like finances */}
      <div className="mb-4">
        <div className="mb-1 text-xs text-[var(--subtle)]">{greeting()}</div>
        {/* Desktop */}
        <div data-layout="desktop" className="hidden md:block">
          <DatePicker
            dateMode="day"
            month={selectedDate}
            currentMonth={today}
            maxMonth={today}
            onChange={({ day }) => day && handleDateChange(day)}
          />
        </div>
        {/* Mobile */}
        <div data-layout="mobile" className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--card2)] px-3 py-2.5 md:hidden">
          <DatePicker
            dateMode="day"
            month={selectedDate}
            currentMonth={today}
            maxMonth={today}
            onChange={({ day }) => day && handleDateChange(day)}
            className="flex-1 justify-between"
            labelClassName="text-[32px] font-bold leading-none tracking-tight"
          />
        </div>
      </div>

      {/* 3-part grid: left = 1 part, right = 2 parts */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:items-start">
        {/* Left column (col-span-1): calorie summary + macro chart */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col items-center gap-3 p-5">
            <CaloriesDonut eaten={totalKcal} cap={cap} min={calorieTargets.minCalories ?? null} textSize="text-2xl" />
            <div className="w-full text-center">
              <p className="text-sm text-[var(--muted)]">
                <span className="text-xl font-bold text-[var(--text)]">{totalKcal}</span>
                {cap !== null && <span className="text-[var(--subtle)]"> / {cap}</span>}
                <span className="ml-1">kcal</span>
              </p>
              {calorieTargets.minCalories !== null && cap !== null && (
                <p className="mt-1 text-xs text-[var(--subtle)]">
                  Range: {calorieTargets.minCalories}–{cap} kcal
                </p>
              )}
              {cap === null && (
                <p className="mt-1 text-xs text-[var(--subtle)]">
                  No goal set.{' '}
                  <Link href="/calories/settings" className="underline underline-offset-2 hover:text-[var(--text)]">
                    Set up profile
                  </Link>
                </p>
              )}
            </div>
          </Card>

          <MacroChart
            protein={totalProtein}
            carbs={totalCarbs}
            fat={totalFat}
            goalProtein={profile?.goalProtein ?? null}
            goalCarbs={profile?.goalCarbs ?? null}
            goalFat={profile?.goalFat ?? null}
          />
        </div>

        {/* Right column (col-span-2): meals list */}
        <div className="col-span-2">
          <MealsSection meals={meals} selectedDate={selectedDate} onChanged={loadData} />
        </div>
      </div>
    </main>
  );
}
