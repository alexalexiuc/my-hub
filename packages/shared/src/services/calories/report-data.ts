import { getMealsForDateRange } from './meals.js';
import { getCalorieProfile } from './profile.js';
import { getMeasurements, getLatestMeasurementsPerType } from '../measurements/measurements.js';
import { findUserById } from '../users/users.js';
import { calculateBMR, calculateCalorieTargets, toUTCDateStr, addDays, getISOWeek } from '../../utils/index.js';
import type { WeeklyReportData, DayData, WeightPoint } from '../email/templates/weekly-report/types.js';
import type {
  MonthlyReportData,
  WeekSummary,
  MeasurementSnapshot,
  MonthlyWeightPoint,
} from '../email/templates/monthly-report/types.js';

// ─── Weekly report data ──────────────────────────────────────────────────────

/**
 * Fetches all data needed to build a weekly calorie report.
 * Returns null if the user logged zero meals in the week.
 */
export async function fetchWeeklyReportCaloriesData(
  userId: string,
  weekStart: Date,
  urls: { unsubscribeUrl: string; viewInAppUrl: string },
): Promise<WeeklyReportData | null> {
  const weekEnd = addDays(weekStart, 6);
  const weekStartStr = toUTCDateStr(weekStart);
  const weekEndStr = toUTCDateStr(weekEnd);

  // One week prior for prior weight delta
  const priorWeekStartStr = toUTCDateStr(addDays(weekStart, -7));
  const priorWeekEndStr = toUTCDateStr(addDays(weekStart, -1));

  const [user, profile, meals, weightMeasurements, allMeasurements, priorWeightMeasurements] = await Promise.all([
    findUserById(userId),
    getCalorieProfile(userId),
    getMealsForDateRange(userId, weekStartStr, weekEndStr),
    getMeasurements(userId, { typeKey: 'weight', dateFrom: weekStartStr, dateTo: weekEndStr, limit: 20 }),
    getLatestMeasurementsPerType(userId),
    getMeasurements(userId, { typeKey: 'weight', dateFrom: priorWeekStartStr, dateTo: priorWeekEndStr, limit: 7 }),
  ]);

  if (!user) return null;
  if (meals.length === 0) return null;

  // Build daily aggregates (Mon=0 … Sun=6)
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
    const date = toUTCDateStr(addDays(weekStart, i));
    const agg = dayMap.get(date);
    days.push(
      agg
        ? { date, kcal: Math.round(agg.kcal), protein: agg.protein, carbs: agg.carbs, fat: agg.fat, hasData: true }
        : { date, kcal: 0, protein: 0, carbs: 0, fat: 0, hasData: false },
    );
  }

  // Weight points (sorted by date asc)
  const weightPoints: WeightPoint[] = weightMeasurements
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.value }));

  // Latest measurements as a record keyed by typeKey
  const latestMeasurements: Record<string, number | null> = {};
  for (const m of allMeasurements) {
    latestMeasurements[m.typeKey] = m.value;
  }

  // Prior week latest weight
  const priorWeekWeight =
    priorWeightMeasurements.length > 0
      ? priorWeightMeasurements.sort((a, b) => b.date.localeCompare(a.date))[0]!.value
      : null;

  // BMR / TDEE — use latest weight measurement
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

  return {
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
    ...urls,
  };
}

// ─── Monthly report data ─────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function longestConsecutiveStreak(loggedDates: Set<string>, year: number, month: number): number {
  const daysInMonth = getDaysInMonth(year, month);
  let max = 0;
  let current = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (loggedDates.has(dateStr)) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

/**
 * Fetches all data needed to build a monthly calorie report.
 * Returns null if the user logged zero meals in the month.
 */
export async function fetchMonthlyReportCaloriesData(
  userId: string,
  monthStart: Date,
  urls: { unsubscribeUrl: string; viewInAppUrl: string },
): Promise<MonthlyReportData | null> {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth() + 1; // 1-12
  const daysInMonth = getDaysInMonth(year, month);
  const monthEnd = new Date(Date.UTC(year, month - 1, daysInMonth));
  const monthStartStr = toUTCDateStr(monthStart);
  const monthEndStr = toUTCDateStr(monthEnd);

  const [user, profile, meals, weightMeasurements, allMeasurements] = await Promise.all([
    findUserById(userId),
    getCalorieProfile(userId),
    getMealsForDateRange(userId, monthStartStr, monthEndStr),
    getMeasurements(userId, { typeKey: 'weight', dateFrom: monthStartStr, dateTo: monthEndStr, limit: 62 }),
    getMeasurements(userId, { dateFrom: monthStartStr, dateTo: monthEndStr, limit: 500 }),
  ]);

  if (!user) return null;
  if (meals.length === 0) return null;

  // Aggregate per day
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

  // BMR / TDEE
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

  // Totals across logged days
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
  const avgCarbs = daysLogged > 0 ? totalCarbs / daysLogged : 0;
  const avgProtein = daysLogged > 0 ? totalProtein / daysLogged : 0;
  const avgFat = daysLogged > 0 ? totalFat / daysLogged : 0;
  const monthlyDeficit = goalMaxCalories * daysLogged - Math.round(totalKcal);

  // Week-by-week breakdown
  const weeks: WeekSummary[] = [];
  let weekStart = new Date(monthStart);
  // Align to Monday of the week containing month start
  const dayOfWeek = weekStart.getUTCDay(); // 0=Sun
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart = addDays(weekStart, -daysBack);

  while (weekStart <= monthEnd) {
    const weekEnd = addDays(weekStart, 6);
    const effectiveStart = weekStart < monthStart ? monthStart : weekStart;
    const effectiveEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

    let weekKcal = 0;
    let weekDaysWithData = 0;
    const current = new Date(effectiveStart);
    while (current <= effectiveEnd) {
      const dateStr = toUTCDateStr(current);
      const agg = dayMap.get(dateStr);
      if (agg) {
        weekKcal += agg.kcal;
        weekDaysWithData++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    const startLabel = effectiveStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const endLabel = effectiveEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

    weeks.push({
      label: `${startLabel}\u2013${endLabel}`,
      avgDailyKcal: weekDaysWithData > 0 ? Math.round(weekKcal / weekDaysWithData) : 0,
      hasData: weekDaysWithData > 0,
    });

    weekStart = addDays(weekEnd, 1);
  }

  // Weight trend
  const weightPoints: MonthlyWeightPoint[] = weightMeasurements
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.value }));

  // Body composition: start and end of month
  function getSnapshot(dateStr: string): MeasurementSnapshot {
    const byType = new Map<string, { value: number; date: string }>();
    // Find nearest measurement at or before dateStr for each type
    for (const m of allMeasurements) {
      if (m.date <= dateStr) {
        const existing = byType.get(m.typeKey);
        if (existing === undefined || m.date > existing.date) {
          byType.set(m.typeKey, { value: m.value, date: m.date });
        }
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

  const startMeasurements = getSnapshot(monthStartStr);
  const endMeasurements = getSnapshot(monthEndStr);

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const streak = longestConsecutiveStreak(loggedDates, year, month);

  return {
    monthStart,
    monthEnd,
    monthLabel,
    year,
    totalDaysInMonth: daysInMonth,
    daysLogged,
    longestStreak: streak,
    goalMaxCalories,
    goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? 0.5,
    bmr: Math.round(bmr ?? tdee),
    tdee: Math.round(tdee),
    avgDailyKcal,
    daysOnTarget,
    monthlyDeficit,
    avgCarbs,
    avgProtein,
    avgFat,
    weeks,
    weightPoints,
    startMeasurements,
    endMeasurements,
    userEmail: user.email,
    ...urls,
  };
}
