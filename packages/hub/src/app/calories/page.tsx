'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { CalorieProfile, MealLog, MeasurementType, User } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets, dateToString } from '@my-hub/shared/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/PageHeader';
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

  const todayKcal = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const todayProtein = Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0));
  const todayCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0));
  const todayFat = Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0));
  const cap = calorieTargets.maxCalories ?? calorieTargets.goalCalories;
  const isOver = cap !== null && todayKcal > cap;
  const remaining = cap !== null ? Math.max(cap - todayKcal, 0) : null;

  // Donut data
  const donutData =
    cap !== null
      ? isOver
        ? [{ value: cap, key: 'eaten' }]
        : [
            { value: todayKcal, key: 'eaten' },
            { value: remaining!, key: 'remaining' },
          ]
      : [{ value: 1, key: 'empty' }];
  const arcColor = cap !== null ? (isOver ? '#ef4444' : '#4ade80') : '#3f3f46';

  // When over, show how much the overflow wraps around (capped at one full revolution)
  const overflowAmount = cap !== null && isOver ? Math.min(todayKcal - cap, cap) : 0;
  const overflowData =
    cap !== null
      ? [
          { value: overflowAmount, key: 'overflow' },
          { value: cap - overflowAmount, key: 'overflow-empty' },
        ]
      : [
          { value: 0, key: 'overflow' },
          { value: 0, key: 'overflow-empty' },
        ];

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

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <PageHeader title="Calories" backHref="/" backLabel="← Home" />

      {/* Today's summary */}
      <div className="rounded-xl border border-green-900/50 bg-gradient-to-br from-green-950/30 to-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Donut */}
          <div className="relative w-[150px] h-[150px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {isOver ? (
                  <>
                    {/* Full red background ring — represents hitting the cap */}
                    <Pie
                      data={[{ value: 1, key: 'bg' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={66}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      <Cell fill="#ef4444" />
                    </Pie>
                    {/* Lighter overlay arc showing how far over the cap we are */}
                    <Pie
                      data={overflowData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={66}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      strokeWidth={0}
                      animationDuration={800}
                    >
                      <Cell key="overflow" fill="#fecaca" />
                      <Cell key="overflow-empty" fill="transparent" />
                    </Pie>
                  </>
                ) : (
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={66}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                    animationDuration={800}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={entry.key} fill={i === 0 ? arcColor : '#27272a'} />
                    ))}
                  </Pie>
                )}
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${isOver ? 'text-red-400' : ''}`}>
                {cap !== null ? (isOver ? `+${todayKcal - cap}` : remaining) : todayKcal}
              </span>
              <span className="text-[11px] text-zinc-500">
                {cap !== null ? (isOver ? 'Over' : 'Remaining') : 'kcal'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 w-full">
            <p className="text-sm text-zinc-400 mb-3">
              <span className="font-semibold text-zinc-200 text-lg">{todayKcal}</span>
              {cap !== null && <> / {cap}</>} kcal {selectedDate === today ? 'today' : selectedDate}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <MacroPill label="Carbs" value={todayCarbs} unit="g" color="bg-amber-400" />
              <MacroPill label="Protein" value={todayProtein} unit="g" color="bg-sky-400" />
              <MacroPill label="Fat" value={todayFat} unit="g" color="bg-rose-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WeeklyChart
          data={weeklyData}
          target={calorieTargets.goalCalories ?? null}
          min={calorieTargets.minCalories ?? null}
          max={calorieTargets.maxCalories ?? null}
        />
        <MacroChart protein={todayProtein} carbs={todayCarbs} fat={todayFat} />
      </div>

      {/* Goal progress */}
      <GoalProgressCard
        days={weekDays}
        weightHistory={weightHistory}
        goalType={profile?.goalType ?? null}
        goalWeeklyRateKg={profile?.goalWeeklyRateKg ?? null}
      />

      {/* Weight trend (shown when enough data) */}
      <WeightChart data={weightChartData} />

      {/* Meals + Measurements row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MealsSection
          meals={meals}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onChanged={loadData}
          goalCalories={calorieTargets.goalCalories}
          minCalories={calorieTargets.minCalories}
          maxCalories={calorieTargets.maxCalories}
        />
        <MeasurementsSection
          latestMeasurements={latestMeasurements}
          measurementTypes={measurementTypes}
          onChanged={loadData}
        />
      </div>

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

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="rounded-lg bg-zinc-800/80 border border-zinc-700/50 px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-sm font-semibold">
        {value} <span className="text-xs font-normal text-zinc-500">{unit}</span>
      </p>
    </div>
  );
}
