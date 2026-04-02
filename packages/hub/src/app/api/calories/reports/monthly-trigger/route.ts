import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  getMealsForDateRange,
  getMeasurements,
  getCalorieProfile,
  sendEmail,
  buildMonthlyReportHtml,
} from '@my-hub/shared/services';
import { calculateBMR, calculateCalorieTargets } from '@my-hub/shared/utils';
import type { MonthlyReportData, WeekSummary, MeasurementSnapshot, MonthlyWeightPoint } from '@my-hub/shared/services';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function longestStreak(loggedDates: Set<string>, year: number, month: number): number {
  const days = getDaysInMonth(year, month);
  let max = 0;
  let cur = 0;
  for (let d = 1; d <= days; d++) {
    const s = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (loggedDates.has(s)) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

function getLastMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

/**
 * POST /api/calories/reports/monthly-trigger
 * Manually sends the monthly report for the authenticated user (for testing).
 */
export const POST = withAuth(async ({ user }) => {
  const monthStart = getLastMonthStart();
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month);
  const monthEnd = new Date(Date.UTC(year, month - 1, daysInMonth));
  const monthStartStr = toDateStr(monthStart);
  const monthEndStr = toDateStr(monthEnd);

  const [profile, meals, weightMeasurements, allMeasurements] = await Promise.all([
    getCalorieProfile(user.id),
    getMealsForDateRange(user.id, monthStartStr, monthEndStr),
    getMeasurements(user.id, { typeKey: 'weight', dateFrom: monthStartStr, dateTo: monthEndStr, limit: 62 }),
    getMeasurements(user.id, { dateFrom: monthStartStr, dateTo: monthEndStr, limit: 500 }),
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

  const loggedDates = new Set(dayMap.keys());
  const daysLogged = loggedDates.size;

  const latestWeight =
    weightMeasurements.length > 0 ? weightMeasurements.sort((a, b) => b.date.localeCompare(a.date))[0]!.value : null;

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
  const tdee = targets.tdee ?? bmr ?? 2000;

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let daysOnTarget = 0;
  for (const [, agg] of dayMap) {
    totalKcal += agg.kcal;
    totalProtein += agg.protein;
    totalCarbs += agg.carbs;
    totalFat += agg.fat;
    if (Math.round(agg.kcal) <= goalMaxCalories) daysOnTarget++;
  }

  const avgDailyKcal = daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0;
  const monthlyDeficit = goalMaxCalories * daysInMonth - Math.round(totalKcal);

  // Week-by-week breakdown
  const weeks: WeekSummary[] = [];
  let weekCursor = new Date(monthStart);
  const dow = weekCursor.getUTCDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  weekCursor = addDays(weekCursor, -daysBack);
  while (weekCursor <= monthEnd) {
    const wEnd = addDays(weekCursor, 6);
    const effStart = weekCursor < monthStart ? monthStart : weekCursor;
    const effEnd = wEnd > monthEnd ? monthEnd : wEnd;
    let wKcal = 0;
    let wDays = 0;
    const cur = new Date(effStart);
    while (cur <= effEnd) {
      const ds = toDateStr(cur);
      const a = dayMap.get(ds);
      if (a) {
        wKcal += a.kcal;
        wDays++;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    const sl = effStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const el = effEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    weeks.push({
      label: `${sl}\u2013${el}`,
      avgDailyKcal: wDays > 0 ? Math.round(wKcal / wDays) : 0,
      hasData: wDays > 0,
    });
    weekCursor = addDays(wEnd, 1);
  }

  const weightPoints: MonthlyWeightPoint[] = weightMeasurements
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.value }));

  function getSnapshot(dateStr: string): MeasurementSnapshot {
    const byType = new Map<string, { value: number; date: string }>();
    for (const m of allMeasurements) {
      if (m.date <= dateStr) {
        const existing = byType.get(m.typeKey);
        if (!existing || m.date > existing.date) byType.set(m.typeKey, { value: m.value, date: m.date });
      }
    }
    return {
      weight: byType.get('weight')?.value ?? null,
      bodyFat: byType.get('body_fat')?.value ?? null,
      waist: byType.get('waist')?.value ?? null,
      chest: byType.get('chest')?.value ?? null,
      neck: byType.get('neck')?.value ?? null,
    };
  }

  const data: MonthlyReportData = {
    monthStart,
    monthEnd,
    monthLabel: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    year,
    totalDaysInMonth: daysInMonth,
    daysLogged,
    longestStreak: longestStreak(loggedDates, year, month),
    goalMaxCalories,
    goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? 0.5,
    bmr: Math.round(bmr ?? tdee),
    tdee: Math.round(tdee),
    avgDailyKcal,
    daysOnTarget,
    monthlyDeficit,
    avgCarbs: daysLogged > 0 ? totalCarbs / daysLogged : 0,
    avgProtein: daysLogged > 0 ? totalProtein / daysLogged : 0,
    avgFat: daysLogged > 0 ? totalFat / daysLogged : 0,
    weeks,
    weightPoints,
    startMeasurements: getSnapshot(monthStartStr),
    endMeasurements: getSnapshot(monthEndStr),
    userEmail: user.email,
  };

  const html = buildMonthlyReportHtml(data);
  await sendEmail({
    to: user.email,
    subject: `[Test] Monthly Calories Report — ${data.monthLabel}`,
    html,
  });

  return NextResponse.json({ sent: true });
});
