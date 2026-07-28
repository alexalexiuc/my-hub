import { describe, expect, it } from 'vitest';
import type { CalorieProfile } from '@my-hub/shared/types';
import { rowToProfile } from './profile';

/** A profile row with every nullable column empty — the shape a barely-filled profile has. */
const EMPTY_ROW: CalorieProfile = {
  id: 1,
  userId: 'user-1',
  age: null,
  sex: null,
  heightCm: null,
  activityLevel: null,
  goalType: null,
  goalWeeklyRateKg: null,
  goalMinCalories: null,
  goalMaxCalories: null,
  goalProtein: null,
  goalCarbs: null,
  goalFat: null,
  gymDays: null,
  gymDayCalorieBonus: null,
  gymTime: null,
  notes: null,
  automationApiKey: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

/** Every nullable column filled, so `omitNullish` drops nothing and the output is maximal. */
const FULL_ROW: CalorieProfile = {
  ...EMPTY_ROW,
  age: 34,
  sex: 'male',
  heightCm: 178,
  activityLevel: 'moderately_active',
  goalType: 'weight_loss',
  goalWeeklyRateKg: 0.5,
  goalMinCalories: 1800,
  goalMaxCalories: 2400,
  goalProtein: 160,
  goalCarbs: 220,
  goalFat: 70,
  gymDays: [0, 4],
  gymDayCalorieBonus: 300,
  gymTime: 'evening',
  notes: 'no dairy',
  automationApiKey: 'secret-key',
};

/**
 * Columns deliberately withheld from the assistant: internal keys, a bookkeeping timestamp,
 * and the automation secret. Everything else must reach it.
 */
const NOT_EXPOSED: (keyof CalorieProfile)[] = ['id', 'userId', 'createdAt', 'automationApiKey'];

describe('rowToProfile', () => {
  // This is the drift guard. Adding a column forces it into the fixtures above (the type check
  // fails otherwise), and from there this test fails unless the column is either exposed or
  // consciously added to NOT_EXPOSED. Two profile fields had already gone missing this way.
  it('exposes every profile column except the ones deliberately withheld', () => {
    const exposed = new Set(Object.keys(rowToProfile(FULL_ROW)));
    const missing = (Object.keys(FULL_ROW) as (keyof CalorieProfile)[]).filter(
      key => !NOT_EXPOSED.includes(key) && !exposed.has(key),
    );

    expect(missing).toEqual([]);
  });

  it('never leaks the automation API key', () => {
    expect(rowToProfile(FULL_ROW)).not.toHaveProperty('automationApiKey');
  });

  it('reports the macro targets used to plan meals', () => {
    const profile = rowToProfile(FULL_ROW);
    expect(profile.goalProtein).toBe(160);
    expect(profile.goalCarbs).toBe(220);
    expect(profile.goalFat).toBe(70);
  });

  it('drops columns the user has not filled in', () => {
    const profile = rowToProfile(EMPTY_ROW);
    expect(profile).not.toHaveProperty('age');
    expect(profile).not.toHaveProperty('gymDays');
    expect(profile).not.toHaveProperty('gymTime');
    expect(profile).not.toHaveProperty('notes');
    expect(profile.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('passes through the values that are set', () => {
    const profile = rowToProfile({ ...EMPTY_ROW, age: 34, sex: 'male', gymDays: [1, 3, 5], gymTime: 'evening' });
    expect(profile.age).toBe(34);
    expect(profile.sex).toBe('male');
    expect(profile.gymDays).toEqual([1, 3, 5]);
    expect(profile.gymTime).toBe('evening');
  });

  describe('gymDayCalorieBonus', () => {
    it('reports the stored bonus', () => {
      expect(rowToProfile({ ...EMPTY_ROW, gymDayCalorieBonus: 450 }).gymDayCalorieBonus).toBe(450);
    });

    it('falls back to the default rather than being omitted when unset', () => {
      // A missing value would read as "no bonus" to the assistant, while the planner in fact
      // applies 300 — so this field is resolved, not passed through like the others.
      expect(rowToProfile(EMPTY_ROW).gymDayCalorieBonus).toBe(300);
    });
  });
});
