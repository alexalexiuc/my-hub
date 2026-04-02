import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  getMealsForDateRange,
  getMeasurements,
  getLatestMeasurementsPerType,
  getCalorieProfile,
  sendEmail,
  buildWeeklyReportHtml,
} from '@my-hub/shared/services';
import { calculateBMR, calculateCalorieTargets } from '@my-hub/shared/utils';
import type { DayData, WeightPoint, WeeklyReportData } from '@my-hub/shared/services';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getLastMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
}

/**
 * POST /api/calories/reports/weekly-trigger
 * Manually sends the weekly report for the authenticated user (for testing).
 */
export const POST = withAuth(async ({ user }) => {
  const weekStart = getLastMonday();
  const weekEnd = addDays(weekStart, 6);
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr = toDateStr(weekEnd);
  const priorWeekStartStr = toDateStr(addDays(weekStart, -7));
  const priorWeekEndStr = toDateStr(addDays(weekStart, -1));

  const [profile, meals, weightMeasurements, allMeasurements, priorWeightMeasurements] = await Promise.all([
    getCalorieProfile(user.id),
    getMealsForDateRange(user.id, weekStartStr, weekEndStr),
    getMeasurements(user.id, { typeKey: 'weight', dateFrom: weekStartStr, dateTo: weekEndStr, limit: 20 }),
    getLatestMeasurementsPerType(user.id),
    getMeasurements(user.id, { typeKey: 'weight', dateFrom: priorWeekStartStr, dateTo: priorWeekEndStr, limit: 7 }),
  ]);

  if (meals.length === 0) {
    return NextResponse.json({ skipped: 'no_data' });
  }

  const dayMap = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>();
  for (const meal of meals) {
    const existing = dayMap.get(meal.date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    dayMap.set(meal.date, {
      kcal: existing.kcal + (meal.kcal ?? 0),
      protein: existing.protein + (meal.protein ?? 0),
      carbs: existing.carbs + (meal.carbs ?? 0),
      fat: existing.fat + (meal.fat ?? 0),
    });
  }

  const days: DayData[] = [];
  for (let i = 0; i < 7; i++) {
    const date = toDateStr(addDays(weekStart, i));
    const agg = dayMap.get(date);
    days.push(
      agg
        ? { date, kcal: Math.round(agg.kcal), protein: agg.protein, carbs: agg.carbs, fat: agg.fat, hasData: true }
        : { date, kcal: 0, protein: 0, carbs: 0, fat: 0, hasData: false },
    );
  }

  const weightPoints: WeightPoint[] = weightMeasurements
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.value }));

  const latestMeasurements: Record<string, number | null> = {};
  for (const m of allMeasurements) latestMeasurements[m.typeKey] = m.value;

  const priorWeekWeight =
    priorWeightMeasurements.length > 0
      ? priorWeightMeasurements.sort((a, b) => b.date.localeCompare(a.date))[0]!.value
      : null;

  const latestWeight = latestMeasurements['weight'] ?? null;
  const bmr = calculateBMR(profile?.age ?? null, profile?.sex ?? null, profile?.heightCm ?? null, latestWeight);
  const targets = calculateCalorieTargets({
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: latestWeight,
    activityLevel: profile?.activityLevel ?? null,
    goalType: profile?.goalType ?? null,
    goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? null,
    goalMinCalories: profile?.goalMinCalories ?? null,
    goalMaxCalories: profile?.goalMaxCalories ?? null,
  });

  const goalMaxCalories = profile?.goalMaxCalories ?? targets.maxCalories ?? 2000;
  const goalMinCalories = profile?.goalMinCalories ?? targets.minCalories ?? 1200;
  const tdee = targets.tdee ?? bmr ?? 2000;

  const data: WeeklyReportData = {
    weekStart,
    weekEnd,
    weekNumber: getISOWeek(weekStart),
    year: weekStart.getUTCFullYear(),
    goalMaxCalories,
    goalMinCalories,
    goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? 0.5,
    bmr: Math.round(bmr ?? tdee),
    tdee: Math.round(tdee),
    days,
    weightPoints,
    latestMeasurements,
    priorWeekWeight,
    userEmail: user.email,
  };

  const html = buildWeeklyReportHtml(data);
  await sendEmail({
    to: user.email,
    subject: `[Test] Weekly Calories Report — Week ${data.weekNumber}, ${data.year}`,
    html,
  });

  return NextResponse.json({ sent: true });
});
