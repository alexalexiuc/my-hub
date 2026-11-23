/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MealCopyError, copyMealsToDate, deleteAllUserMeals, deleteMeal, getMeals, logMeal, updateMeal } from './meals';

vi.mock('../../db/client.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));

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
  beforeEach(() => vi.clearAllMocks());

  it('inserts the row as given and returns it', async () => {
    const values = vi.fn().mockReturnThis();
    vi.mocked(db).insert.mockReturnValueOnce({
      values,
      returning: vi.fn().mockResolvedValue([MEAL_ROW]),
    } as any);

    const result = await logMeal({ ...MEAL_ROW } as any);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ mealId: 'meal-abc', userId: 'user-1' }));
    expect(result).toEqual(MEAL_ROW);
  });

  it('throws rather than returning nothing when the insert reports no row', async () => {
    vi.mocked(db).insert.mockReturnValueOnce({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    } as any);

    await expect(logMeal({ ...MEAL_ROW } as any)).rejects.toThrow(/did not return a row/i);
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

describe('copyMealsToDate', () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * A transaction whose `select`s answer in order (the emptiness check first, when asked for,
   * then the source day) and whose insert echoes the rows it was given.
   */
  function mockTransaction(selects: unknown[][]) {
    const inserted = vi.fn();
    const tx = {
      execute: vi.fn(() => Promise.resolve()),
      select: vi.fn(() => {
        const rows = selects.shift() ?? [];
        const chain: any = {
          from: () => chain,
          where: () => chain,
          limit: () => Promise.resolve(rows),
          orderBy: () => Promise.resolve(rows),
        };
        return chain;
      }),
      insert: vi.fn(() => ({
        values: (values: unknown[]) => {
          inserted(values);
          return { returning: () => Promise.resolve(values) };
        },
      })),
    };
    vi.mocked(db).transaction.mockImplementationOnce((fn: any) => fn(tx));
    return { tx, inserted };
  }

  it('re-logs every meal of the source day on the target day, in order, as new entries', async () => {
    const second = { ...MEAL_ROW, id: 2, mealId: 'meal-def', mealType: 'dinner', description: 'Soup', notes: 'hot' };
    const { inserted } = mockTransaction([[MEAL_ROW, second]]);

    const copied = await copyMealsToDate('user-1', '2026-08-01', '2026-08-02');

    expect(copied).toHaveLength(2);
    const rows = inserted.mock.calls[0]![0] as any[];
    expect(rows.map(r => [r.date, r.description, r.kcal, r.notes])).toEqual([
      ['2026-08-02', 'Chicken and rice', 600, null],
      ['2026-08-02', 'Soup', 600, 'hot'],
    ]);
    // Fresh ids, and logged-at times a millisecond apart so the day keeps its order.
    expect(rows.every(r => r.mealId && r.mealId !== 'meal-abc' && r.mealId !== 'meal-def')).toBe(true);
    expect(rows[1].loggedAt.getTime() - rows[0].loggedAt.getTime()).toBe(1);
  });

  it('returns nothing and writes nothing when the source day is empty', async () => {
    const { tx } = mockTransaction([[]]);
    await expect(copyMealsToDate('user-1', '2026-08-01', '2026-08-02')).resolves.toEqual([]);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('with onlyIfEmpty, refuses a target day that already has meals', async () => {
    const { tx } = mockTransaction([[{ id: 9 }], [MEAL_ROW]]);
    await expect(copyMealsToDate('user-1', '2026-08-01', '2026-08-02', { onlyIfEmpty: true })).rejects.toBeInstanceOf(
      MealCopyError,
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('with onlyIfEmpty, copies onto an empty target day', async () => {
    mockTransaction([[], [MEAL_ROW]]);
    await expect(copyMealsToDate('user-1', '2026-08-01', '2026-08-02', { onlyIfEmpty: true })).resolves.toHaveLength(1);
  });

  it('takes the per-day lock before reading, so concurrent copies run one after the other', async () => {
    const { tx } = mockTransaction([[MEAL_ROW]]);
    await copyMealsToDate('user-1', '2026-08-01', '2026-08-02');
    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(tx.execute.mock.invocationCallOrder[0]).toBeLessThan(tx.select.mock.invocationCallOrder[0]!);
  });

  it('refuses to copy a day onto itself, without opening a transaction', async () => {
    await expect(copyMealsToDate('user-1', '2026-08-01', '2026-08-01')).rejects.toBeInstanceOf(MealCopyError);
    expect(vi.mocked(db).transaction).not.toHaveBeenCalled();
  });
});
