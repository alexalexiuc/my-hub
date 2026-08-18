/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAllUserMeals, deleteMeal, getMeals, logMeal, updateMeal } from './meals';

vi.mock('../../db/client.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));

const tryLinkLoggedMealToPlan = vi.fn().mockResolvedValue(false);
vi.mock('./weekly-menu', () => ({ tryLinkLoggedMealToPlan: (...args: unknown[]) => tryLinkLoggedMealToPlan(...args) }));

import { db } from '../../db/client.js';

const MEAL_ROW = {
  id: 1,
  mealId: 'meal-abc',
  userId: 'user-1',
  date: '2026-08-01',
  mealType: 'lunch',
  description: 'Chicken and rice',
  kcal: 600,
  protein: 40,
  carbs: 60,
  fat: 12,
  notes: null,
  loggedAt: new Date(),
  createdAt: new Date(),
};

/**
 * Captures what reaches Drizzle's `.set()`. That object is the whole point of these tests: it is
 * where "leave this field alone" and "clear this field" have to stay distinguishable.
 */
function mockUpdate(rows: unknown[]) {
  const set = vi.fn().mockReturnThis();
  vi.mocked(db).update.mockReturnValueOnce({
    set,
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
  return set;
}

describe('updateMeal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes an explicit null through, so a saved value can be cleared', async () => {
    const set = mockUpdate([{ ...MEAL_ROW, kcal: null }]);

    const result = await updateMeal('user-1', 'meal-abc', { kcal: null, notes: null });

    expect(set).toHaveBeenCalledWith({ kcal: null, notes: null });
    expect(result!.kcal).toBeNull();
  });

  it('drops undefined fields, so an unedited field is left alone', async () => {
    const set = mockUpdate([MEAL_ROW]);

    await updateMeal('user-1', 'meal-abc', { description: 'Renamed', kcal: undefined, protein: undefined });

    expect(set).toHaveBeenCalledWith({ description: 'Renamed' });
  });

  it('keeps a zero, which is a value and not an absence', async () => {
    const set = mockUpdate([{ ...MEAL_ROW, kcal: 0 }]);

    await updateMeal('user-1', 'meal-abc', { kcal: 0 });

    expect(set).toHaveBeenCalledWith({ kcal: 0 });
  });

  it('returns null when no meal with that id belongs to the user', async () => {
    mockUpdate([]);

    expect(await updateMeal('user-1', 'someone-elses-meal', { description: 'x' })).toBeNull();
  });
});

describe('logMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tryLinkLoggedMealToPlan.mockReset().mockResolvedValue(false);
  });

  function mockInsert(rows: unknown[]) {
    const values = vi.fn().mockReturnThis();
    vi.mocked(db).insert.mockReturnValueOnce({
      values,
      returning: vi.fn().mockResolvedValue(rows),
    } as any);
    return values;
  }

  it('inserts the row as given and returns it', async () => {
    const values = mockInsert([MEAL_ROW]);

    const result = await logMeal({ ...MEAL_ROW } as any);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ mealId: 'meal-abc', userId: 'user-1' }));
    expect(result).toEqual(MEAL_ROW);
  });

  it('throws rather than returning nothing when the insert reports no row', async () => {
    mockInsert([]);

    await expect(logMeal({ ...MEAL_ROW } as any)).rejects.toThrow(/did not return a row/i);
  });

  it('tries to link the new entry to a matching planned menu slot', async () => {
    mockInsert([MEAL_ROW]);

    await logMeal({ ...MEAL_ROW } as any);

    expect(tryLinkLoggedMealToPlan).toHaveBeenCalledWith(
      'user-1',
      '2026-08-01',
      'lunch',
      'meal-abc',
      'Chicken and rice',
    );
  });

  it('does not attempt to link when the inserted row has no mealId', async () => {
    mockInsert([{ ...MEAL_ROW, mealId: null }]);

    await logMeal({ ...MEAL_ROW, mealId: null } as any);

    expect(tryLinkLoggedMealToPlan).not.toHaveBeenCalled();
  });

  it('still returns the logged meal when linking fails, since the journal write already succeeded', async () => {
    mockInsert([MEAL_ROW]);
    tryLinkLoggedMealToPlan.mockRejectedValueOnce(new Error('boom'));

    const result = await logMeal({ ...MEAL_ROW } as any);

    expect(result).toEqual(MEAL_ROW);
  });
});

describe('getMeals', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Records whether `.limit()` was reached, which is the part of the chain worth pinning. */
  function mockSelect(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    };
    vi.mocked(db).select.mockReturnValueOnce(chain);
    return { chain, limit };
  }

  it('applies a limit when one is given', async () => {
    const { limit } = mockSelect([MEAL_ROW]);

    await getMeals('user-1', { limit: 5 });

    expect(limit).toHaveBeenCalledWith(5);
  });

  it('leaves the query unbounded when no limit is given', async () => {
    const { limit } = mockSelect([MEAL_ROW]);

    await getMeals('user-1', {});

    expect(limit).not.toHaveBeenCalled();
  });

  it('starts at offset 0 unless told otherwise', async () => {
    const { chain } = mockSelect([]);

    await getMeals('user-1', {});

    expect(chain.offset).toHaveBeenCalledWith(0);
  });
});

describe('deleteMeal', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockDelete(rows: unknown[]) {
    vi.mocked(db).delete.mockReturnValueOnce({
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(rows),
    } as any);
  }

  it('returns the deleted row, or null when it was not the user’s to delete', async () => {
    mockDelete([MEAL_ROW]);
    expect(await deleteMeal('user-1', 'meal-abc')).toEqual(MEAL_ROW);

    mockDelete([]);
    expect(await deleteMeal('user-1', 'meal-abc')).toBeNull();
  });

  it('counts the rows removed for a full wipe', async () => {
    mockDelete([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(await deleteAllUserMeals('user-1')).toBe(3);
  });
});
