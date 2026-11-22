import { describe, expect, it } from 'vitest';
import { ProfileFormSchema, buildFormValues, formToProfileBody } from './profile-form.schema';

const BLANK = buildFormValues(null, undefined);

describe('ProfileFormSchema', () => {
  it('refuses a minimum above the maximum, on the minimum field', () => {
    const result = ProfileFormSchema.safeParse({ ...BLANK, goalMinCalories: '2200', goalMaxCalories: '1800' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['goalMinCalories']);
  });

  it('accepts either bound alone, or min equal to max', () => {
    expect(ProfileFormSchema.safeParse({ ...BLANK, goalMinCalories: '2200' }).success).toBe(true);
    expect(ProfileFormSchema.safeParse({ ...BLANK, goalMinCalories: '2000', goalMaxCalories: '2000' }).success).toBe(
      true,
    );
  });
});

describe('formToProfileBody', () => {
  it('rounds the gym-day bonus to whole kcal', () => {
    expect(formToProfileBody({ ...BLANK, gymDayCalorieBonus: '250.6' }, 'g', null).gymDayCalorieBonus).toBe(251);
  });

  it('converts % macros to grams against max calories', () => {
    const body = formToProfileBody(
      { ...BLANK, goalMaxCalories: '2000', goalProtein: '30', goalCarbs: '40', goalFat: '30' },
      '%',
      2000,
    );
    expect(body).toMatchObject({ goalProtein: 150, goalCarbs: 200, goalFat: 67 });
  });

  it('sends null for cleared goals so saving clears them', () => {
    expect(formToProfileBody(BLANK, 'g', null)).toMatchObject({
      goalType: null,
      goalMinCalories: null,
      goalProtein: null,
    });
  });
});
