import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDateString } from '@my-hub/shared/utils';
import { dayTargetFields } from './targets';

// The profile from the gym/recovery bug report: Mon, Wed, Thu, Fri training, 2900–3000 overrides.
const profile = {
  age: 30,
  sex: 'male' as const,
  heightCm: 185,
  activityLevel: 'moderately_active' as const,
  goalType: 'weight_gain' as const,
  goalWeeklyRateKg: 0.2,
  goalMinCalories: 2900,
  goalMaxCalories: 3000,
  gymDays: [0, 2, 3, 4],
  gymDayCalorieBonus: 300,
};

describe('dayTargetFields', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['2026-11-09', true], // Monday
    ['2026-11-10', false],
    ['2026-11-11', true],
    ['2026-11-12', true],
    ['2026-11-13', true],
    ['2026-11-07', false], // Saturday
    ['2026-11-08', false], // Sunday
  ])('%s → gym day %s', (date, isGymDay) => {
    expect(dayTargetFields(profile, 88, date)).toEqual(
      isGymDay
        ? { isGymDay: true, gymDayBonusApplied: 300, dayTarget: 3300, dayMin: 3200 }
        : { isGymDay: false, gymDayBonusApplied: 0, dayTarget: 3000, dayMin: 2900 },
    );
  });

  it('gives every day the base range when no gym days are set', () => {
    for (const date of ['2026-11-07', '2026-11-09', '2026-11-12']) {
      expect(dayTargetFields({ ...profile, gymDays: [] }, 88, date)).toEqual({
        isGymDay: false,
        gymDayBonusApplied: 0,
        dayTarget: 3000,
        dayMin: 2900,
      });
    }
  });

  it('judges a meal at 00:30 in Chișinău by the local day, not the UTC one', () => {
    // 2026-11-08T22:30Z is Sunday in UTC but already Monday 00:30 in Chișinău (UTC+2).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T22:30:00Z'));
    const date = localDateString('Europe/Chisinau');
    expect(date).toBe('2026-11-09');
    expect(dayTargetFields(profile, 88, date).isGymDay).toBe(true);
  });
});
