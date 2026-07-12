/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addMealToMenu, updateWeeklyMenuMeal, deleteWeeklyMenuMeal, logMenuMeal } from './weekly-menu';

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
