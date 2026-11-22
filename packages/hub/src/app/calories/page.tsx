'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MeasurementTypes, measurementTypeDefinitions } from '@my-hub/shared/constants';
import { dateToString, dayCalorieTargets, latestWeightKg, shiftDateStr } from '@my-hub/shared/utils';
import { Button, Card, DatePicker, ProgressBar } from '@/components';
import { mealEvents } from './mealEvents';
import { MealsSection } from './MealsSection';
import { NextMealCard } from './NextMealCard';
import { MacroChart } from './MacroChart';
import { CaloriesDonut } from './CaloriesDonut';
import { LastSevenDays } from './LastSevenDays';
import { MeasurementModal } from './MeasurementModal';
import { sumMealTotals } from './calories.utils';
import { MACRO_COLORS, STREAK_LOOKBACK_DAYS } from './constants';
import { setCaloriesSelectedDate } from './selectedDate';
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible';
import { PageError, PageLoading } from './ui';
import { useCalorieProfile } from './useCalorieProfile';
import { useMealsForDate } from './useMealsForDate';
import { useCalendarDays } from './calendar/useCalendarDays';

const NO_RANGE = { target: null, min: null, isGymDay: false, gymDayBonus: 0 };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayPage() {
  const {
    profile,
    measurements: latestMeasurements,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
  } = useCalorieProfile();
  const [loggingWeight, setLoggingWeight] = useState(false);

  const today = dateToString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const { meals: dayMeals, error: mealsError } = useMealsForDate(selectedDate);
  // True while the user is on "today" rather than a day they picked: a page left open overnight
  // then moves on to the new day instead of showing yesterday as if it were still today.
  const followsToday = useRef(true);

  // The layout's Add meal buttons log to the day on screen; cleared on leave so they fall back
  // to today everywhere else.
  useEffect(() => {
    setCaloriesSelectedDate(selectedDate);
  }, [selectedDate]);
  useEffect(() => () => setCaloriesSelectedDate(null), []);

  function handleDateChange(date: string) {
    followsToday.current = date === dateToString(new Date());
    setSelectedDate(date);
  }

  // Claude logs meals while this page sits open — catch up when the user comes back (the
  // profile hook reloads itself). A new day already loads everything for that day, so only an
  // unchanged day needs the `changed` nudge.
  useRefetchOnVisible(async () => {
    const now = dateToString(new Date());
    if (followsToday.current && selectedDate !== now) handleDateChange(now);
    else mealEvents.emit('changed');
  });

  // The day's range as the server resolves it — the one rule, with finished days frozen. Within the
  // streak window this is the same request the seven-day strip makes (`useCalendarDays` shares it),
  // so picking a recent day needs no request at all; an older day loads just itself.
  const windowFrom = shiftDateStr(today, -(STREAK_LOOKBACK_DAYS - 1));
  const { days: calendarDays } = useCalendarDays(
    selectedDate >= windowFrom
      ? { dateFrom: windowFrom, dateTo: today }
      : { dateFrom: selectedDate, dateTo: selectedDate },
  );
  // Matched by date, so the previous day's range never shows under a new one while it loads.
  const serverRange = calendarDays?.find(d => d.date === selectedDate);

  if (profileError) return <PageError error={profileError} />;
  if (profileLoading) return <PageLoading />;

  const meals = dayMeals ?? [];
  const {
    target: cap,
    min: minTarget,
    isGymDay,
    gymDayBonus,
  } = serverRange ??
  // Until it arrives: today follows the live rule anyway, while a past day may be frozen at another
  // range, so it shows none rather than one that would then jump.
  (selectedDate >= today ? dayCalorieTargets(profile, latestWeightKg(latestMeasurements), selectedDate) : NO_RANGE);
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
            void reloadProfile(true);
            // A weigh-in can move a TDEE-based target, which the day's range comes from.
            mealEvents.emit('changed');
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
          {mealsError ? (
            <p className="rounded-xl border border-[var(--red)] bg-[var(--red-d)] px-4 py-3 text-sm text-[var(--red)]">
              Couldn&apos;t load this day&apos;s meals: {mealsError}
            </p>
          ) : (
            // Keyed on the day, so its local notes ("nothing to copy") don't follow you to another.
            <MealsSection
              key={selectedDate}
              meals={meals}
              loading={dayMeals === null}
              selectedDate={selectedDate}
              gymTime={profile?.gymTime ?? null}
              onChanged={() => mealEvents.emit('changed')}
            />
          )}
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
