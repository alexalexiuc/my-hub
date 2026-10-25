'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import Link from 'next/link';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { MeasurementTypes, measurementTypeDefinitions } from '@my-hub/shared/constants';
import { dateToString, dayCalorieTargets, latestWeightKg } from '@my-hub/shared/utils';
import { Button, Card, DatePicker, ProgressBar } from '@/components';
import { mealEvents } from './mealEvents';
import { MealsSection } from './MealsSection';
import { NextMealCard } from './NextMealCard';
import { MacroChart } from './MacroChart';
import { CaloriesDonut } from './CaloriesDonut';
import { LastSevenDays } from './LastSevenDays';
import { MeasurementModal } from './MeasurementModal';
import { sumMealTotals } from './calories.utils';
import { MACRO_COLORS } from './constants';
import { setCaloriesSelectedDate } from './selectedDate';
import { NOT_SIGNED_IN, PageError, PageLoading } from './ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingWeight, setLoggingWeight] = useState(false);

  const today = dateToString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedDateRef = useRef(selectedDate);

  // The layout's Add meal buttons log to the day on screen; cleared on leave so they fall back
  // to today everywhere else.
  useEffect(() => {
    setCaloriesSelectedDate(selectedDate);
  }, [selectedDate]);
  useEffect(() => () => setCaloriesSelectedDate(null), []);

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
      setError(e instanceof ApiError && e.status === 401 ? NOT_SIGNED_IN : String(e));
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

  if (loading) return <PageLoading />;
  if (error) return <PageError error={error} />;

  const {
    target: cap,
    min: minTarget,
    isGymDay,
    gymDayBonus,
  } = dayCalorieTargets(profile, latestWeightKg(latestMeasurements), selectedDate);
  const totals = sumMealTotals(meals);
  const remainingKcal = cap === null ? null : cap - totals.kcal;
  const goalProtein = profile?.goalProtein ?? null;
  const proteinLeft = goalProtein === null ? null : Math.max(0, Math.round(goalProtein - totals.protein));
  const isToday = selectedDate === today;
  const weighedToday = latestMeasurements.some(m => m.typeKey === MeasurementTypes.Weight && m.date === today);

  return (
    <main>
      {loggingWeight && (
        <MeasurementModal
          measurementTypes={measurementTypeDefinitions}
          defaultTypeKey={MeasurementTypes.Weight}
          onClose={() => setLoggingWeight(false)}
          onSaved={() => {
            setLoggingWeight(false);
            void loadData();
          }}
        />
      )}

      {/* Greeting + date picker */}
      <div className="mb-4">
        <div className="mb-1 text-xs text-[var(--subtle)]">{greeting()}</div>
        <DatePicker
          dateMode="day"
          month={selectedDate}
          currentMonth={today}
          maxMonth={today}
          onChange={({ day }) => day && handleDateChange(day)}
        />
      </div>

      {/* 3-part grid: left = 1 part, right = 2 parts.
          The wide column comes first in the DOM so that on a phone — where the grid collapses to
          a stack — the plan leads instead of sitting below the donut and the macro card. Columns
          are placed explicitly rather than left to auto-flow, so that source order doesn't decide
          the desktop layout. Rows are deliberately *not* placed: `NextMealCard` renders nothing on
          a day with no plan, and a reserved row would leave a hole above the meals list. */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:items-start">
        <div className="flex flex-col gap-4 md:col-start-2 md:col-span-2">
          {isToday && !weighedToday && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--blue-d)] px-4 py-2.5">
              <span className="text-sm text-[var(--text)]">No weigh-in today</span>
              <Button variant="neutral" size="sm" onClick={() => setLoggingWeight(true)}>
                Log weight
              </Button>
            </div>
          )}
          <NextMealCard date={selectedDate} loggedMeals={meals} remainingKcal={remainingKcal} />
          <MealsSection
            meals={meals}
            selectedDate={selectedDate}
            gymTime={profile?.gymTime ?? null}
            onChanged={loadData}
          />
        </div>

        {/* Left column (col-span-1): what's left, the week so far, macro split */}
        <div className="flex flex-col gap-4 md:col-start-1 md:row-start-1">
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-4">
              <CaloriesDonut eaten={totals.kcal} cap={cap} min={minTarget} textSize="text-2xl" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-[var(--muted)]">
                  <span className="text-lg font-bold text-[var(--text)]">{totals.kcal.toLocaleString()}</span>
                  {cap !== null && <span> of {cap.toLocaleString()}</span>}
                  <span className="ml-1">kcal</span>
                </p>
                {cap !== null && (
                  <p className="text-xs text-[var(--subtle)]">
                    {minTarget !== null ? `Aim for ${minTarget.toLocaleString()}–${cap.toLocaleString()}` : 'Daily cap'}
                    {isGymDay && <span className="text-[var(--accent)]"> · gym day · +{gymDayBonus} kcal</span>}
                  </p>
                )}
                {cap === null && (
                  <p className="text-xs text-[var(--subtle)]">
                    No goal set.{' '}
                    <Link href="/calories/settings" className="underline underline-offset-2 hover:text-[var(--text)]">
                      Set up profile
                    </Link>
                  </p>
                )}
              </div>
            </div>

            {goalProtein !== null && proteinLeft !== null && (
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold" style={{ color: MACRO_COLORS.protein }}>
                    Protein
                  </span>
                  <span className="text-[var(--muted)]">
                    {proteinLeft > 0 ? (
                      <>
                        <strong className="text-[var(--text)]">{proteinLeft} g</strong> left of {goalProtein} g
                      </>
                    ) : (
                      <strong className="text-[var(--green)]">Goal reached · {totals.protein} g</strong>
                    )}
                  </span>
                </div>
                <ProgressBar
                  value={totals.protein}
                  max={goalProtein}
                  thresholds={false}
                  color={MACRO_COLORS.protein}
                  height={6}
                />
              </div>
            )}
          </Card>

          <LastSevenDays proteinGoalG={goalProtein} />

          <MacroChart
            protein={totals.protein}
            carbs={totals.carbs}
            fat={totals.fat}
            goalProtein={goalProtein}
            goalCarbs={profile?.goalCarbs ?? null}
            goalFat={profile?.goalFat ?? null}
          />
        </div>
      </div>
    </main>
  );
}
