/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addMealToMenu, updateWeeklyMenuMeal } from './weekly-menu';

// ---------------------------------------------------------------------------
// Mock the DB client
// ---------------------------------------------------------------------------

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '../../db/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MENU_ROW = { menuId: 'menu-abc' };

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

// ---------------------------------------------------------------------------
// addMealToMenu
// ---------------------------------------------------------------------------

describe('addMealToMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when menu is not found for the user', async () => {
    mockSelectOwnership([]); // no menu row → ownership check fails
    const result = await addMealToMenu('user-1', 'menu-abc', {
      dayOfWeek: 0,
      mealType: 'breakfast',
      description: 'Oatmeal',
    });
    expect(result).toBeNull();
    expect(vi.mocked(db).insert).not.toHaveBeenCalled();
  });

  it('returns the inserted meal on success', async () => {
    mockSelectOwnership([MENU_ROW]);
    mockInsertReturning([MEAL_ROW]);

    const result = await addMealToMenu('user-1', 'menu-abc', {
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
    mockSelectOwnership([MENU_ROW]);
    mockInsertReturning([]); // conflict → no rows returned

    const result = await addMealToMenu('user-1', 'menu-abc', {
      dayOfWeek: 0,
      mealType: 'breakfast',
      description: 'Duplicate meal',
    });

    expect(result).toBeNull();
  });

  it('passes optional fields as null when omitted', async () => {
    mockSelectOwnership([MENU_ROW]);

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

    await addMealToMenu('user-1', 'menu-abc', {
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
    mockSelectOwnership([]);
    const result = await updateWeeklyMenuMeal('user-1', 'menu-abc', 0, 'breakfast', {
      description: 'New meal',
    });
    expect(result).toBeNull();
    expect(vi.mocked(db).update).not.toHaveBeenCalled();
  });

  it('returns the updated meal on success', async () => {
    mockSelectOwnership([MENU_ROW]);
    const updated = { ...MEAL_ROW, description: 'Greek yogurt bowl', kcal: 300 };
    mockUpdateReturning([updated]);

    const result = await updateWeeklyMenuMeal('user-1', 'menu-abc', 0, 'breakfast', {
      description: 'Greek yogurt bowl',
      kcal: 300,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toBe('Greek yogurt bowl');
    expect(result!.kcal).toBe(300);
  });

  it('returns null when no meal row matches (wrong day/type)', async () => {
    mockSelectOwnership([MENU_ROW]);
    mockUpdateReturning([]); // no matching row

    const result = await updateWeeklyMenuMeal('user-1', 'menu-abc', 3, 'dinner', {
      description: 'Something',
    });

    expect(result).toBeNull();
  });

  it('sets optional fields to null when not provided', async () => {
    mockSelectOwnership([MENU_ROW]);

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

    await updateWeeklyMenuMeal('user-1', 'menu-abc', 0, 'breakfast', {
      description: 'Plain oats',
    });

    expect(capturedSet.kcal).toBeNull();
    expect(capturedSet.protein).toBeNull();
    expect(capturedSet.carbs).toBeNull();
    expect(capturedSet.fat).toBeNull();
    expect(capturedSet.description).toBe('Plain oats');
  });
});
