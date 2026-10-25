'use client';

import { FeatureTheme } from '@/components';
import { useState, useEffect, useCallback } from 'react';
import {
  dateToString,
  calculateMacroKcal,
  dayCalorieTargets,
  latestWeightKg,
  shiftDateStr,
  summariseTargetAdherence,
} from '@my-hub/shared/utils';
import { SectionCard } from '@/components';
import { PlusOutlineIcon, ScaleIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import { CalendarResponseSchema } from '@/app/api/calories/calendar/calendar.schemas';
import { CaloriesDonut } from './CaloriesDonut';
import { MealModal } from './MealModal';
import { MeasurementModal } from './MeasurementModal';
import { mealEvents } from './mealEvents';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';
import type { GymTime } from '@my-hub/shared/constants';
import type { CalorieProfile, MealLog } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';

interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

function MacroBar({
  label,
  value,
  goal,
  sharePct,
  color,
}: {
  label: string;
  value: number;
  goal: number | null;
  sharePct: number;
  color: string;
}) {
  const reached = goal !== null && goal > 0 && value >= goal;
  const barPct = goal !== null && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : sharePct;
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
      {goal !== null && goal > 0 ? (
        <p className="text-sm font-semibold">
          {reached ? (
            <span className="text-[var(--green)]">✓</span>
          ) : (
            <>
              {value}
              <span className="text-xs font-normal text-[var(--muted)]">/{goal}g</span>
            </>
          )}
        </p>
      ) : (
        <p className="text-sm font-semibold">{value}g</p>
      )}
      <div className="mt-1 h-1 w-full rounded-full bg-[var(--card2)] overflow-hidden">
        <div
          className={`h-full rounded-full ${reached ? 'bg-[var(--green)]' : color}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

/** How far back the streak is counted — matches the Today tab's "Last 7 days" card. */
const STREAK_LOOKBACK_DAYS = 30;

export function CaloriesWidget() {
  const [loading, setLoading] = useState(true);
  const [todayKcal, setTodayKcal] = useState(0);
  const [todayTarget, setTodayTarget] = useState<number | null>(null);
  const [minCalories, setMinCalories] = useState<number | null>(null);
  // Held so the Add-meal modal doesn't re-fetch the profile this widget has already loaded.
  const [gymTime, setGymTime] = useState<GymTime | null>(null);
  const [macros, setMacros] = useState<Macros>({ protein: 0, carbs: 0, fat: 0 });
  const [macroGoals, setMacroGoals] = useState<Macros | null>(null);
  const [streak, setStreak] = useState(0);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showAddWeight, setShowAddWeight] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = dateToString(new Date());
      const [profileData, mealsData, calendarData] = await Promise.all([
        apiFetch<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>(
          '/api/calories/profile',
        ).catch(() => null),
        apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date: today, limit: 200 } }).catch(() => null),
        apiFetch('/api/calories/calendar', {
          query: { dateFrom: shiftDateStr(today, -(STREAK_LOOKBACK_DAYS - 1)), dateTo: today },
          responseSchema: CalendarResponseSchema,
          silentToast: true,
        }).catch(() => null),
      ]);

      const profile: CalorieProfile | null = profileData?.profile ?? null;
      const measurements: MeasurementWithType[] = profileData?.measurements ?? [];
      const meals: MealLog[] = mealsData?.meals ?? [];

      const kcal = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
      const newMacros: Macros = {
        protein: Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0)),
        carbs: Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0)),
        fat: Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0)),
      };

      // Same resolver as the Today tab and the weekly menu — this widget is a fourth surface
      // showing today's target, and it used to omit the gym-day bonus the others apply.
      const { target, min } = dayCalorieTargets(profile, latestWeightKg(measurements), today);

      setStreak(calendarData ? summariseTargetAdherence(calendarData.days, today, null).currentStreak : 0);
      setTodayKcal(kcal);
      setTodayTarget(target);
      setMinCalories(min);
      setGymTime(profile?.gymTime ?? null);
      setMacros(newMacros);
      setMacroGoals(
        profile?.goalProtein != null || profile?.goalCarbs != null || profile?.goalFat != null
          ? { protein: profile?.goalProtein ?? 0, carbs: profile?.goalCarbs ?? 0, fat: profile?.goalFat ?? 0 }
          : null,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load(true);
    mealEvents.on('changed', handler);
    return () => mealEvents.off('changed', handler);
  }, [load]);

  const totalMacroKcal = calculateMacroKcal(macros.protein, macros.carbs, macros.fat);
  const sharePct = (kcal: number) => (totalMacroKcal > 0 ? Math.round((kcal / totalMacroKcal) * 100) : 0);

  // `dayCalorieTargets` already resolves the one ceiling for the day, bonus included.
  const cap = todayTarget;
  const today = dateToString(new Date());

  return (
    <FeatureTheme feature="calories">
      {showAddMeal && (
        <MealModal
          date={today}
          gymTime={gymTime}
          onClose={() => setShowAddMeal(false)}
          onSaved={() => {
            setShowAddMeal(false);
            mealEvents.emit('changed');
          }}
        />
      )}
      {showAddWeight && (
        <MeasurementModal
          measurementTypes={measurementTypeDefinitions}
          defaultTypeKey="weight"
          onClose={() => setShowAddWeight(false)}
          onSaved={() => {
            setShowAddWeight(false);
            load(true);
          }}
        />
      )}

      <SectionCard
        title="Calories"
        titleHref="/calories"
        titleHoverClass="hover:text-[var(--accent)]"
        className="border-[var(--border)] bg-gradient-to-br from-[var(--card2)] to-[var(--card)]"
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAddWeight(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
              aria-label="Log weight"
              title="Log weight"
            >
              <ScaleIcon className="size-3" />
              Weight
            </button>
            <button
              onClick={() => setShowAddMeal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
              aria-label="Log meal"
              title="Log meal"
            >
              <PlusOutlineIcon className="size-3" />
              Add
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="mx-auto w-[140px] h-[140px] rounded-full bg-[var(--card2)]" />
            <div className="h-4 w-24 mx-auto bg-[var(--card2)] rounded" />
            <div className="flex gap-4 pt-3 border-t border-[var(--border)]">
              <div className="flex-1 h-8 bg-[var(--card2)] rounded" />
              <div className="flex-1 h-8 bg-[var(--card2)] rounded" />
              <div className="flex-1 h-8 bg-[var(--card2)] rounded" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <CaloriesDonut eaten={todayKcal} cap={cap} min={minCalories} innerRadius={45} />

            <p className="text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--text)]">{todayKcal}</span>
              {cap !== null && (
                <>
                  {' '}
                  <span className="text-[var(--subtle)]">/</span> <span>{cap}</span>
                </>
              )}{' '}
              kcal
            </p>
            {(minCalories !== null || cap !== null) && (
              <p
                className={`text-xs mt-1 ${
                  cap !== null && todayKcal > cap
                    ? 'text-[var(--red)]'
                    : minCalories !== null && todayKcal < minCalories
                      ? 'text-[var(--amber)]'
                      : 'text-[var(--muted)]'
                }`}
              >
                {minCalories !== null && cap !== null
                  ? `Target range: ${minCalories}-${cap} kcal`
                  : minCalories !== null
                    ? `Minimum target: ${minCalories} kcal`
                    : `Target: ${cap} kcal`}
              </p>
            )}
            {streak > 1 && (
              <p className="mt-1 text-xs font-semibold text-[var(--accent)]">{streak}-day streak on target</p>
            )}
            {cap === null && (
              <p className="text-xs text-[var(--muted)] mt-1">
                No goal set.{' '}
                <a
                  href="/calories/settings"
                  className="text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)]"
                >
                  Complete your profile
                </a>
                .
              </p>
            )}

            <div className="flex gap-4 w-full mt-4 pt-3 border-t border-[var(--border)]">
              <MacroBar
                label="Carbs"
                value={macros.carbs}
                goal={macroGoals?.carbs ?? null}
                sharePct={sharePct(macros.carbs * 4)}
                color="bg-amber-400"
              />
              <MacroBar
                label="Protein"
                value={macros.protein}
                goal={macroGoals?.protein ?? null}
                sharePct={sharePct(macros.protein * 4)}
                color="bg-sky-400"
              />
              <MacroBar
                label="Fat"
                value={macros.fat}
                goal={macroGoals?.fat ?? null}
                sharePct={sharePct(macros.fat * 9)}
                color="bg-rose-400"
              />
            </div>
          </div>
        )}
      </SectionCard>
    </FeatureTheme>
  );
}
