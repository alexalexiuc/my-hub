/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWeeklyMenu,
  addMealToMenu,
  updateWeeklyMenuMeal,
  upsertMenuMeal,
  deleteWeeklyMenuMeal,
  logMenuMeal,
} from './weekly-menu';

// ---------------------------------------------------------------------------
// Mock the DB client
// ---------------------------------------------------------------------------

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

import { db } from '../../db/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Row shape returned by the hasAccessToMenu count query */
const ACCESS_GRANTED_ROW = { count: 1 };
const ACCESS_DENIED_ROW = { count: 0 };

const MEAL_ROW = {
  id: 1,
  menuId: 'menu-abc',
  dayOfWeek: 0,
  mealType: 'breakfast',
  description: 'Oatmeal with berries',
  kcal: 350,
  protein: 12,
  carbs: 60,
  fat: 7,
  createdAt: new Date(),
};

/** Make db.select() resolve to rows for the ownership check */
function mockSelectOwnership(rows: unknown[]) {
  vi.mocked(db).select.mockReturnValueOnce({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  } as any);
}

/** Make db.insert() return rows via .returning() */
function mockInsertReturning(rows: unknown[]) {
  vi.mocked(db).insert.mockReturnValueOnce({
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
}

/** Make db.update() return rows via .returning() */
function mockUpdateReturning(rows: unknown[]) {
  vi.mocked(db).update.mockReturnValueOnce({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
}

/** Make the next db.delete() resolve rows via .where().returning() (meal-row delete) */
function mockDeleteReturning(rows: unknown[]) {
  vi.mocked(db).delete.mockReturnValueOnce({
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
}

/** Make the next db.delete() resolve directly via .where() (day-log cleanup) */
function mockDeleteResolves() {
  vi.mocked(db).delete.mockReturnValueOnce({
    where: vi.fn().mockResolvedValue(undefined),
  } as any);
}

/** Make db.insert() return rows via .onConflictDoUpdate().returning() (upsert) */
function mockUpsertReturning(rows: unknown[]) {
  vi.mocked(db).insert.mockReturnValueOnce({
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
}

// ---------------------------------------------------------------------------
// createWeeklyMenu
// ---------------------------------------------------------------------------

/**
 * Transaction handle for createWeeklyMenu: one delete (the replaced menu) and up to
 * three inserts (menu row, meals, shopping items), each read back via `.returning()`.
 */
function makeCreateTx({
  replacedRows = [] as unknown[],
  menuRows = [{ menuId: 'menu-new', weekStart: '2026-07-13' }] as unknown[],
  mealRows = [] as unknown[],
  shoppingRows = [] as unknown[],
} = {}) {
  const values = (rows: unknown[]) => ({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }),
      returning: vi.fn().mockResolvedValue(rows),
    }),
  });

  return {
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(replacedRows) }),
    }),
    insert: vi
      .fn()
      .mockReturnValueOnce(values(menuRows) as any)
      .mockReturnValueOnce(values(mealRows) as any)
      .mockReturnValueOnce(values(shoppingRows) as any),
  };
}

describe('createWeeklyMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the menu, its meals and its shopping list in one transaction', async () => {
    const tx = makeCreateTx({
      mealRows: [MEAL_ROW],
      shoppingRows: [{ id: 1, text: '1kg chicken breast' }],
    });
    vi.mocked(db).transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await createWeeklyMenu({
      userId: 'user-1',
      weekStart: '2026-07-13',
      meals: [{ dayOfWeek: 0, mealType: 'breakfast', description: 'Oatmeal with berries' }],
      shoppingList: ['1kg chicken breast'],
    });

    // Everything goes through the tx handle — nothing is written outside it
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(3); // menu + meals + shopping items
    expect(vi.mocked(db).insert).not.toHaveBeenCalled();
    expect(result.meals).toEqual([MEAL_ROW]);
    expect(result.shoppingList).toEqual([{ id: 1, text: '1kg chicken breast' }]);
  });

  it('skips the shopping-list insert when no list is given', async () => {
    const tx = makeCreateTx();
    vi.mocked(db).transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await createWeeklyMenu({
      userId: 'user-1',
      weekStart: '2026-07-13',
      meals: [],
    });

    expect(tx.insert).toHaveBeenCalledTimes(1); // menu row only
    expect(result.shoppingList).toEqual([]);
  });

  it('trims and case-insensitively dedupes the shopping list before inserting', async () => {
    const tx = makeCreateTx({ shoppingRows: [{ id: 1 }] });
    vi.mocked(db).transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    await createWeeklyMenu({
      userId: 'user-1',
      weekStart: '2026-07-13',
      meals: [],
      shoppingList: ['  Eggs  ', 'eggs', '', '   '],
    });

    const shoppingInsert = tx.insert.mock.results[1]?.value;
    expect(shoppingInsert.values).toHaveBeenCalledWith([
      { menuId: expect.any(String), userId: 'user-1', text: 'Eggs' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// addMealToMenu
// ---------------------------------------------------------------------------

describe('addMealToMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when menu is not found for the user', async () => {
    mockSelectOwnership([ACCESS_DENIED_ROW]); // count=0 → ownership check fails
    const result = await addMealToMenu('user-add-1', 'menu-abc', {
      dayOfWeek: 0,
      mealType: 'breakfast',
      description: 'Oatmeal',
    });
    expect(result).toBeNull();
    expect(vi.mocked(db).insert).not.toHaveBeenCalled();
  });

  it('returns the inserted meal on success', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    mockInsertReturning([MEAL_ROW]);

    const result = await addMealToMenu('user-add-2', 'menu-abc', {
      dayOfWeek: 0,
      mealType: 'breakfast',
      description: 'Oatmeal with berries',
      kcal: 350,
      protein: 12,
      carbs: 60,
      fat: 7,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toBe('Oatmeal with berries');
    expect(result!.kcal).toBe(350);
    expect(result!.mealType).toBe('breakfast');
  });

  it('returns null when onConflictDoNothing skips the insert (slot already exists)', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    mockInsertReturning([]); // conflict → no rows returned

    const result = await addMealToMenu('user-add-3', 'menu-abc', {
      dayOfWeek: 0,
      mealType: 'breakfast',
      description: 'Duplicate meal',
    });

    expect(result).toBeNull();
  });

  it('passes optional fields as null when omitted', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);

    let capturedValues: any = null;
    vi.mocked(db).insert.mockReturnValueOnce({
      values: vi.fn().mockImplementation((v: any) => {
        capturedValues = v;
        return {
          onConflictDoNothing: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ ...MEAL_ROW, kcal: null, protein: null, carbs: null, fat: null }]),
        };
      }),
    } as any);

    await addMealToMenu('user-add-4', 'menu-abc', {
      dayOfWeek: 1,
      mealType: 'lunch',
      description: 'Salad',
    });

    expect(capturedValues.kcal).toBeNull();
    expect(capturedValues.protein).toBeNull();
    expect(capturedValues.carbs).toBeNull();
    expect(capturedValues.fat).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// upsertMenuMeal
// ---------------------------------------------------------------------------

describe('upsertMenuMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when menu is not found for the user', async () => {
    mockSelectOwnership([ACCESS_DENIED_ROW]);
    const result = await upsertMenuMeal('user-upsert-1', 'menu-abc', {
      dayOfWeek: 0,
      mealType: 'breakfast',
      description: 'Oatmeal',
    });
    expect(result).toBeNull();
    expect(vi.mocked(db).insert).not.toHaveBeenCalled();
  });

  it('returns the meal and clears the slot day-log on insert-or-overwrite', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    const upserted = { ...MEAL_ROW, description: 'Tuna salad', kcal: 400 };
    mockUpsertReturning([upserted]);
    mockDeleteResolves(); // day-log cleanup

    const result = await upsertMenuMeal('user-upsert-2', 'menu-abc', {
      dayOfWeek: 0,
      mealType: 'lunch',
      description: 'Tuna salad',
      kcal: 400,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toBe('Tuna salad');
    // A re-defined dish must not inherit the previous meal's "logged" marker
    expect(vi.mocked(db).delete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// updateWeeklyMenuMeal
// ---------------------------------------------------------------------------

describe('updateWeeklyMenuMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when menu is not found for the user', async () => {
    mockSelectOwnership([ACCESS_DENIED_ROW]);
    const result = await updateWeeklyMenuMeal('user-update-1', 'menu-abc', 0, 'breakfast', {
      description: 'New meal',
    });
    expect(result).toBeNull();
    expect(vi.mocked(db).update).not.toHaveBeenCalled();
  });

  it('returns the updated meal on success and clears the slot day-log', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    const updated = { ...MEAL_ROW, description: 'Greek yogurt bowl', kcal: 300 };
    mockUpdateReturning([updated]);
    mockDeleteResolves(); // day-log cleanup

    const result = await updateWeeklyMenuMeal('user-update-2', 'menu-abc', 0, 'breakfast', {
      description: 'Greek yogurt bowl',
      kcal: 300,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toBe('Greek yogurt bowl');
    expect(result!.kcal).toBe(300);
    // The old dish's "logged" marker must not carry over to the replacement meal
    expect(vi.mocked(db).delete).toHaveBeenCalledTimes(1);
  });

  it('does not touch the day-log when no meal row matches', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    mockUpdateReturning([]);

    await updateWeeklyMenuMeal('user-update-5', 'menu-abc', 3, 'dinner', { description: 'X' });

    expect(vi.mocked(db).delete).not.toHaveBeenCalled();
  });

  it('returns null when no meal row matches (wrong day/type)', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    mockUpdateReturning([]); // no matching row

    const result = await updateWeeklyMenuMeal('user-update-3', 'menu-abc', 3, 'dinner', {
      description: 'Something',
    });

    expect(result).toBeNull();
  });

  it('sets optional fields to null when not provided', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    mockDeleteResolves(); // day-log cleanup after the successful update

    let capturedSet: any = null;
    vi.mocked(db).update.mockReturnValueOnce({
      set: vi.fn().mockImplementation((data: any) => {
        capturedSet = data;
        return {
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ ...MEAL_ROW, kcal: null }]),
        };
      }),
    } as any);

    await updateWeeklyMenuMeal('user-update-4', 'menu-abc', 0, 'breakfast', {
      description: 'Plain oats',
    });

    expect(capturedSet.kcal).toBeNull();
    expect(capturedSet.protein).toBeNull();
    expect(capturedSet.carbs).toBeNull();
    expect(capturedSet.fat).toBeNull();
    expect(capturedSet.description).toBe('Plain oats');
  });
});

// ---------------------------------------------------------------------------
// deleteWeeklyMenuMeal
// ---------------------------------------------------------------------------

describe('deleteWeeklyMenuMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when menu is not found for the user', async () => {
    mockSelectOwnership([ACCESS_DENIED_ROW]);
    const result = await deleteWeeklyMenuMeal('user-del-1', 'menu-abc', 0, 'breakfast');
    expect(result).toBe(false);
    expect(vi.mocked(db).delete).not.toHaveBeenCalled();
  });

  it('returns true and clears the day-log when a meal row is removed', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    mockDeleteReturning([{ id: 1 }]); // meal row deleted
    mockDeleteResolves(); // day-log cleanup

    const result = await deleteWeeklyMenuMeal('user-del-2', 'menu-abc', 0, 'breakfast');

    expect(result).toBe(true);
    expect(vi.mocked(db).delete).toHaveBeenCalledTimes(2); // meal + day-log
  });

  it('returns false and skips day-log cleanup when no meal row matches', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    mockDeleteReturning([]); // nothing deleted

    const result = await deleteWeeklyMenuMeal('user-del-3', 'menu-abc', 3, 'dinner');

    expect(result).toBe(false);
    expect(vi.mocked(db).delete).toHaveBeenCalledTimes(1); // only the meal delete attempt
  });
});

// ---------------------------------------------------------------------------
// logMenuMeal
// ---------------------------------------------------------------------------

/**
 * Transaction stub whose first insert (day-log marker) resolves `dayLogRows`
 * via .onConflictDoNothing().returning(), and whose second insert (meal_logs
 * journal entry) resolves directly from .values().
 */
function makeTx(dayLogRows: unknown[]) {
  const insert = vi
    .fn()
    .mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(dayLogRows),
        }),
      }),
    } as any)
    .mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    } as any);
  return { insert };
}

describe('logMenuMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false without writing when the menu is not the user’s', async () => {
    mockSelectOwnership([ACCESS_DENIED_ROW]);

    const result = await logMenuMeal('user-log-1', 'menu-abc', 0, 'breakfast', '2026-07-13', { description: 'Oats' });

    expect(result).toBe(false);
    expect(vi.mocked(db).transaction).not.toHaveBeenCalled();
  });

  it('marks the slot and writes the journal entry in one transaction', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    const tx = makeTx([{ id: 7 }]);
    vi.mocked(db).transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await logMenuMeal('user-log-2', 'menu-abc', 0, 'breakfast', '2026-07-13', {
      description: 'Oats',
      kcal: 350,
      protein: 12,
    });

    expect(result).toBe(true);
    expect(tx.insert).toHaveBeenCalledTimes(2); // day-log marker + meal_logs entry
  });

  it('does not duplicate the journal entry when the slot is already logged', async () => {
    mockSelectOwnership([ACCESS_GRANTED_ROW]);
    const tx = makeTx([]); // onConflictDoNothing skipped the marker insert
    vi.mocked(db).transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await logMenuMeal('user-log-3', 'menu-abc', 0, 'breakfast', '2026-07-13', { description: 'Oats' });

    expect(result).toBe(true);
    expect(tx.insert).toHaveBeenCalledTimes(1); // marker attempt only — no second journal row
  });
});
