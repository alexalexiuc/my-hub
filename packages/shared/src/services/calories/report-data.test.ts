/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchWeeklyReportCaloriesData, fetchMonthlyReportCaloriesData } from './report-data';

vi.mock('./meals.js', () => ({ getMealsForDateRange: vi.fn() }));
vi.mock('./profile.js', () => ({ getCalorieProfile: vi.fn() }));
vi.mock('../measurements/measurements.js', () => ({
  getMeasurements: vi.fn(),
}));
vi.mock('../users/users.js', () => ({ findUserById: vi.fn() }));

import { getMealsForDateRange } from './meals.js';
import { getCalorieProfile } from './profile.js';
import { getMeasurements } from '../measurements/measurements.js';
import { findUserById } from '../users/users.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMeal(date: string, kcal: number, protein = 30, carbs = 50, fat = 10) {
  return {
    date,
    kcal,
    protein,
    carbs,
    fat,
    id: 'meal-1',
    userId: 'u1',
    mealId: 'm1',
    mealType: 'lunch',
    notes: null,
    loggedAt: new Date(),
    createdAt: new Date(),
  };
}

function makeMeasurement(typeKey: string, date: string, value: number) {
  return {
    id: 'ms-1',
    userId: 'u1',
    typeKey,
    date,
    value,
    notes: null,
    createdAt: new Date(),
    typeLabel: typeKey,
    typeUnit: 'kg',
  };
}

const mockUser = {
  id: 'u1',
  email: 'user@example.com',
  name: 'Test',
  createdAt: new Date(),
  updatedAt: new Date(),
  passwordHash: null,
};

const mockProfile = {
  id: 'p1',
  userId: 'u1',
  age: 30,
  sex: 'male' as const,
  heightCm: 175,
  activityLevel: 'moderate' as const,
  goalType: 'lose' as const,
  goalWeeklyRateKg: 0.5,
  goalMinCalories: 1500,
  goalMaxCalories: 2000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Monday 2026-03-30
const WEEK_START = new Date('2026-03-30T00:00:00.000Z');

// 2026-03-01
const MONTH_START = new Date('2026-03-01T00:00:00.000Z');

// ─── fetchWeeklyReportCaloriesData ────────────────────────────────────────────

describe('fetchWeeklyReportCaloriesData', () => {
  beforeEach(() => {
    vi.mocked(findUserById).mockResolvedValue(mockUser as any);
    vi.mocked(getCalorieProfile).mockResolvedValue(mockProfile as any);
    vi.mocked(getMealsForDateRange).mockResolvedValue([]);
    vi.mocked(getMeasurements).mockResolvedValue([]);
  });

  it('returns null when user is not found', async () => {
    vi.mocked(findUserById).mockResolvedValue(undefined);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns null when no meals were logged', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([]);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns report with correct weekStart and weekEnd', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result).not.toBeNull();
    expect(result!.weekStart).toEqual(WEEK_START);
    expect(result!.weekEnd).toEqual(new Date('2026-04-05T00:00:00.000Z'));
  });

  it('returns correct weekNumber and year', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.weekNumber).toBe(14); // 2026-03-30 is week 14
    expect(result!.year).toBe(2026);
  });

  it('builds 7 DayData entries covering the full week', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.days).toHaveLength(7);
    expect(result!.days[0]!.date).toBe('2026-03-30');
    expect(result!.days[6]!.date).toBe('2026-04-05');
  });

  it('aggregates multiple meals on the same day', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-30', 800, 20, 100, 10),
      makeMeal('2026-03-30', 700, 30, 80, 15),
    ] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    const mon = result!.days[0]!;
    expect(mon.hasData).toBe(true);
    expect(mon.kcal).toBe(1500);
    expect(mon.protein).toBe(50);
    expect(mon.carbs).toBe(180);
    expect(mon.fat).toBe(25);
  });

  it('marks days without meals as hasData=false with zeroed macros', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    // Tuesday through Sunday should have no data
    for (const day of result!.days.slice(1)) {
      expect(day.hasData).toBe(false);
      expect(day.kcal).toBe(0);
    }
  });

  it('sorts weight points by date ascending', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce([
        makeMeasurement('weight', '2026-04-02', 80),
        makeMeasurement('weight', '2026-03-31', 81),
      ] as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]); // prior week
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.weightPoints[0]!.date).toBe('2026-03-31');
    expect(result!.weightPoints[1]!.date).toBe('2026-04-02');
  });

  it('sets priorWeekWeight to the latest measurement from the prior week', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce([]) // current week weights
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeMeasurement('weight', '2026-03-24', 82),
        makeMeasurement('weight', '2026-03-26', 83),
      ] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    // Latest by date desc → 2026-03-26 → 83
    expect(result!.priorWeekWeight).toBe(83);
  });

  it('sets priorWeekWeight to null when no prior measurements exist', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    vi.mocked(getMeasurements).mockResolvedValue([]);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.priorWeekWeight).toBeNull();
  });

  it('builds latestMeasurements record keyed by typeKey from measurements up to week end', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeMeasurement('weight', '2026-03-30', 80),
        makeMeasurement('body_fat', '2026-03-30', 15),
      ] as any)
      .mockResolvedValueOnce([]);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.latestMeasurements['weight']).toBe(80);
    expect(result!.latestMeasurements['body_fat']).toBe(15);
  });

  it('uses profile goalMaxCalories and goalMinCalories when set', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.goalMaxCalories).toBe(2000);
    expect(result!.goalMinCalories).toBe(1500);
  });

  it('falls back goalMaxCalories to 2000 when profile and targets are null', async () => {
    vi.mocked(getCalorieProfile).mockResolvedValue(undefined);
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.goalMaxCalories).toBe(2000);
  });

  it('includes userEmail from the fetched user', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-30', 1800)] as any);
    const result = await fetchWeeklyReportCaloriesData('u1', WEEK_START);
    expect(result!.userEmail).toBe('user@example.com');
  });
});

// ─── fetchMonthlyReportCaloriesData ──────────────────────────────────────────

describe('fetchMonthlyReportCaloriesData', () => {
  beforeEach(() => {
    vi.mocked(findUserById).mockResolvedValue(mockUser as any);
    vi.mocked(getCalorieProfile).mockResolvedValue(mockProfile as any);
    vi.mocked(getMealsForDateRange).mockResolvedValue([]);
    vi.mocked(getMeasurements).mockResolvedValue([]);
  });

  it('returns null when user is not found', async () => {
    vi.mocked(findUserById).mockResolvedValue(undefined);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result).toBeNull();
  });

  it('returns null when no meals were logged', async () => {
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result).toBeNull();
  });

  it('returns correct monthLabel and year', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-10', 1800)] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.monthLabel).toBe('March 2026');
    expect(result!.year).toBe(2026);
    expect(result!.totalDaysInMonth).toBe(31);
  });

  it('counts daysLogged correctly', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-01', 1800),
      makeMeal('2026-03-01', 400), // same day — counts once
      makeMeal('2026-03-15', 2000),
    ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.daysLogged).toBe(2);
  });

  it('computes avgDailyKcal as total kcal divided by daysLogged', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-01', 1200),
      makeMeal('2026-03-02', 1800),
    ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.avgDailyKcal).toBe(1500); // (1200+1800)/2
  });

  it('counts daysOnTarget correctly', async () => {
    // goalMaxCalories = 2000 (from mockProfile)
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-01', 1800), // ≤ 2000 → on target
      makeMeal('2026-03-02', 2500), // > 2000 → over
      makeMeal('2026-03-03', 2000), // exactly 2000 → on target
    ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.daysOnTarget).toBe(2);
  });

  it('computes monthlyDeficit as goalMax * daysLogged - totalKcal', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-01', 1800),
      makeMeal('2026-03-02', 1600),
    ] as any);
    // goalMaxCalories=2000, daysLogged=2, totalKcal=3400
    // deficit = 2000*2 - 3400 = 600
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.monthlyDeficit).toBe(600);
  });

  it('computes longestStreak correctly', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-01', 1800),
      makeMeal('2026-03-02', 1800),
      makeMeal('2026-03-03', 1800),
      makeMeal('2026-03-10', 1800), // gap → streak broken
    ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.longestStreak).toBe(3);
  });

  it('computes longestStreak as 1 for non-consecutive days', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-01', 1800),
      makeMeal('2026-03-03', 1800),
      makeMeal('2026-03-05', 1800),
    ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.longestStreak).toBe(1);
  });

  it('computes longestStreak across the full month', async () => {
    // All 31 days logged
    const meals = Array.from({ length: 31 }, (_, i) => makeMeal(`2026-03-${String(i + 1).padStart(2, '0')}`, 1800));
    vi.mocked(getMealsForDateRange).mockResolvedValue(meals as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.longestStreak).toBe(31);
  });

  it('sorts weight points by date ascending', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-10', 1800)] as any);
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce([
        makeMeasurement('weight', '2026-03-20', 79),
        makeMeasurement('weight', '2026-03-05', 81),
      ] as any)
      .mockResolvedValueOnce([]); // all measurements for snapshot
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.weightPoints[0]!.date).toBe('2026-03-05');
    expect(result!.weightPoints[1]!.date).toBe('2026-03-20');
  });

  it('builds startMeasurements snapshot from measurements at or before month start', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-10', 1800)] as any);
    // allMeasurements call (second getMeasurements call)
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce([]) // weight measurements
      .mockResolvedValueOnce([
        makeMeasurement('weight', '2026-03-01', 82),
        makeMeasurement('weight', '2026-03-20', 80), // after start — not in startSnapshot
        makeMeasurement('body_fat', '2026-02-28', 18), // before start — included
      ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.startMeasurements.weight).toBe(82);
    expect(result!.startMeasurements.bodyFat).toBe(18);
  });

  it('builds endMeasurements snapshot using the latest measurement at or before month end', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-10', 1800)] as any);
    vi.mocked(getMeasurements)
      .mockResolvedValueOnce([]) // weight measurements
      .mockResolvedValueOnce([
        makeMeasurement('weight', '2026-03-01', 82),
        makeMeasurement('weight', '2026-03-25', 79),
      ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    // Latest weight at or before 2026-03-31 → 2026-03-25 → 79
    expect(result!.endMeasurements.weight).toBe(79);
  });

  it('produces week summaries covering the full month', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([
      makeMeal('2026-03-02', 1800),
      makeMeal('2026-03-09', 1600),
    ] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.weeks.length).toBeGreaterThan(0);
    // Every week with data should have avgDailyKcal > 0
    const withData = result!.weeks.filter(w => w.hasData);
    expect(withData.length).toBe(2);
    for (const w of withData) {
      expect(w.avgDailyKcal).toBeGreaterThan(0);
    }
  });

  it('week without meals has hasData=false and avgDailyKcal=0', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-02', 1800)] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    const emptyWeeks = result!.weeks.filter(w => !w.hasData);
    for (const w of emptyWeeks) {
      expect(w.avgDailyKcal).toBe(0);
    }
  });

  it('includes userEmail in result', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-10', 1800)] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.userEmail).toBe('user@example.com');
  });

  it('uses profile goalMaxCalories when set', async () => {
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-10', 1800)] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.goalMaxCalories).toBe(2000);
  });

  it('falls back goalMaxCalories to 2000 when profile is absent', async () => {
    vi.mocked(getCalorieProfile).mockResolvedValue(undefined);
    vi.mocked(getMealsForDateRange).mockResolvedValue([makeMeal('2026-03-10', 1800)] as any);
    const result = await fetchMonthlyReportCaloriesData('u1', MONTH_START);
    expect(result!.goalMaxCalories).toBe(2000);
  });
});
