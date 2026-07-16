import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  upsertMenuMeal,
  deleteWeeklyMenuMeal,
  deleteWeeklyMenu,
  createWeeklyMenu,
  updateWeeklyMenu,
  replaceShoppingListItems,
  getUserCalorieTargets,
} from '@my-hub/shared/services';
import {
  SetMenuMealSchema,
  RemoveMenuMealSchema,
  setMenuMealTool,
  removeMenuMealTool,
  deleteWeeklyMenuTool,
  setPrepNotesTool,
  setShoppingListTool,
  planWeekTool,
} from './weekly-menu';
import { caloriesContext, parseToolPayload } from './test-utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@my-hub/shared/services', () => ({
  upsertMenuMeal: vi.fn(),
  deleteWeeklyMenuMeal: vi.fn(),
  deleteWeeklyMenu: vi.fn(),
  createWeeklyMenu: vi.fn(),
  updateWeeklyMenu: vi.fn(),
  replaceShoppingListItems: vi.fn(),
  getUserCalorieTargets: vi.fn(),
  getSharedMenusForWeek: vi.fn(),
  getWeeklyMenuByWeek: vi.fn(),
  getWeeklyMenus: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ctx = caloriesContext;
const parsePayload = parseToolPayload;

const BASE_MEAL = {
  id: 42,
  menuId: 'menu-xyz',
  dayOfWeek: 0,
  mealType: 'pre_workout',
  description: 'Banana and protein shake',
  kcal: 250,
  protein: 30,
  carbs: 28,
  fat: 3,
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// SetMenuMealSchema validation
// ---------------------------------------------------------------------------

describe('SetMenuMealSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = SetMenuMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 0,
      mealType: 'pre_workout',
      description: 'Banana and shake',
      kcal: 250,
      protein: 30,
      carbs: 28,
      fat: 3,
    });
    expect(result.success).toBe(true);
  });

  it('accepts input with only required fields', () => {
    const result = SetMenuMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 2,
      mealType: 'snack',
      description: 'Apple',
    });
    expect(result.success).toBe(true);
  });

  it('rejects dayOfWeek outside 0–6', () => {
    const result = SetMenuMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 7,
      mealType: 'snack',
      description: 'Apple',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown mealType', () => {
    const result = SetMenuMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 1,
      mealType: 'brunch',
      description: 'Eggs',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing description', () => {
    const result = SetMenuMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 3,
      mealType: 'dinner',
    });
    expect(result.success).toBe(false);
  });

  it('accepts pre_workout, post_workout and other meal types', () => {
    for (const mealType of ['pre_workout', 'post_workout', 'other']) {
      const result = SetMenuMealSchema.safeParse({
        menuId: 'menu-xyz',
        dayOfWeek: 0,
        mealType,
        description: 'Something',
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// setMenuMealTool — insert-or-overwrite a slot
// ---------------------------------------------------------------------------

describe('setMenuMealTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success=true with the meal and a message on insert', async () => {
    vi.mocked(upsertMenuMeal).mockResolvedValue(BASE_MEAL as never);

    const result = await setMenuMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 0,
        mealType: 'pre_workout',
        description: 'Banana and protein shake',
        kcal: 250,
        protein: undefined,
        carbs: undefined,
        fat: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; meal: { mealType: string }; message: string };
    expect(payload.success).toBe(true);
    expect(payload.meal.mealType).toBe('pre_workout');
    expect(payload.message).toContain('Set');
    expect(payload.message).toContain('Mon');
    expect(payload.message).toContain('250 kcal');
  });

  it('returns success=true when overwriting an existing slot', async () => {
    const overwritten = { ...BASE_MEAL, mealType: 'lunch', description: 'Tuna salad', kcal: 400 };
    vi.mocked(upsertMenuMeal).mockResolvedValue(overwritten as never);

    const result = await setMenuMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 0,
        mealType: 'lunch',
        description: 'Tuna salad',
        kcal: 400,
        protein: undefined,
        carbs: undefined,
        fat: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; meal: { description: string }; message: string };
    expect(payload.success).toBe(true);
    expect(payload.meal.description).toBe('Tuna salad');
    expect(payload.message).toContain('400 kcal');
  });

  it('returns success=false when the menu is not found', async () => {
    vi.mocked(upsertMenuMeal).mockResolvedValue(null);

    const result = await setMenuMealTool(
      {
        menuId: 'missing-id',
        dayOfWeek: 0,
        mealType: 'breakfast',
        description: 'Eggs',
        kcal: undefined,
        protein: undefined,
        carbs: undefined,
        fat: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('not found');
  });

  it('passes kcal and macros correctly to upsertMenuMeal', async () => {
    vi.mocked(upsertMenuMeal).mockResolvedValue(BASE_MEAL as never);

    await setMenuMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 2,
        mealType: 'dinner',
        description: 'Steak',
        kcal: 700,
        protein: 60,
        carbs: 10,
        fat: 30,
      },
      ctx,
    );

    expect(upsertMenuMeal).toHaveBeenCalledWith(
      'user-1',
      'menu-xyz',
      expect.objectContaining({
        dayOfWeek: 2,
        mealType: 'dinner',
        description: 'Steak',
        kcal: 700,
        protein: 60,
        carbs: 10,
        fat: 30,
      }),
    );
  });

  it('passes null for optional fields when omitted', async () => {
    vi.mocked(upsertMenuMeal).mockResolvedValue(BASE_MEAL as never);

    await setMenuMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 1,
        mealType: 'snack',
        description: 'Nuts',
        kcal: undefined,
        protein: undefined,
        carbs: undefined,
        fat: undefined,
      },
      ctx,
    );

    expect(upsertMenuMeal).toHaveBeenCalledWith(
      'user-1',
      'menu-xyz',
      expect.objectContaining({
        kcal: null,
        protein: null,
        carbs: null,
        fat: null,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// removeMenuMealTool
// ---------------------------------------------------------------------------

describe('RemoveMenuMealSchema', () => {
  it('accepts a valid slot including the other meal type', () => {
    expect(RemoveMenuMealSchema.safeParse({ menuId: 'menu-xyz', dayOfWeek: 1, mealType: 'other' }).success).toBe(true);
  });

  it('rejects an unknown mealType', () => {
    expect(RemoveMenuMealSchema.safeParse({ menuId: 'menu-xyz', dayOfWeek: 1, mealType: 'brunch' }).success).toBe(
      false,
    );
  });
});

describe('removeMenuMealTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success=true and a message when a meal is removed', async () => {
    vi.mocked(deleteWeeklyMenuMeal).mockResolvedValue(true);

    const result = await removeMenuMealTool({ menuId: 'menu-xyz', dayOfWeek: 0, mealType: 'snack' }, ctx);

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(true);
    expect(payload.message).toContain('Mon');
    expect(deleteWeeklyMenuMeal).toHaveBeenCalledWith('user-1', 'menu-xyz', 0, 'snack');
  });

  it('returns success=false when the slot does not exist', async () => {
    vi.mocked(deleteWeeklyMenuMeal).mockResolvedValue(false);

    const result = await removeMenuMealTool({ menuId: 'menu-xyz', dayOfWeek: 3, mealType: 'dinner' }, ctx);

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toMatch(/no dinner found/i);
  });
});

// ---------------------------------------------------------------------------
// deleteWeeklyMenuTool
// ---------------------------------------------------------------------------

describe('deleteWeeklyMenuTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success=true when the menu is deleted', async () => {
    vi.mocked(deleteWeeklyMenu).mockResolvedValue(true);

    const result = await deleteWeeklyMenuTool({ menuId: 'menu-xyz' }, ctx);

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(true);
    expect(deleteWeeklyMenu).toHaveBeenCalledWith('user-1', 'menu-xyz');
  });

  it('returns success=false when the menu is not found', async () => {
    vi.mocked(deleteWeeklyMenu).mockResolvedValue(false);

    const result = await deleteWeeklyMenuTool({ menuId: 'missing-id' }, ctx);

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// planWeekTool
// ---------------------------------------------------------------------------

describe('planWeekTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate (dayOfWeek, mealType) slots instead of silently dropping meals', async () => {
    const meal = {
      dayOfWeek: 0,
      mealType: 'lunch',
      kcal: undefined,
      protein: undefined,
      carbs: undefined,
      fat: undefined,
    } as const;

    const result = await planWeekTool(
      {
        weekStart: '2026-07-13',
        title: undefined,
        prepNotes: undefined,
        shoppingList: undefined,
        meals: [
          { ...meal, description: 'Chicken with rice' },
          { ...meal, description: 'Tuna salad' },
        ],
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toMatch(/duplicate meal slot/i);
    expect(createWeeklyMenu).not.toHaveBeenCalled();
  });

  it('returns success=false when the menu cannot be saved', async () => {
    vi.mocked(getUserCalorieTargets).mockResolvedValue(null);
    vi.mocked(createWeeklyMenu).mockRejectedValue(new Error('db down'));

    const result = await planWeekTool(
      {
        weekStart: '2026-07-13',
        title: undefined,
        prepNotes: undefined,
        shoppingList: undefined,
        meals: [
          {
            dayOfWeek: 0,
            mealType: 'lunch',
            description: 'Chicken with rice',
            kcal: undefined,
            protein: undefined,
            carbs: undefined,
            fat: undefined,
          },
        ],
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toMatch(/could not save/i);
  });

  it('writes prep notes and the shopping list in one call', async () => {
    vi.mocked(getUserCalorieTargets).mockResolvedValue(null);
    vi.mocked(createWeeklyMenu).mockResolvedValue({
      menuId: 'menu-1',
      weekStart: '2026-07-13',
      title: null,
      notes: 'Roast 1kg chicken Sunday',
      meals: [{ mealType: 'lunch' }],
      shoppingList: [{ id: 1 }, { id: 2 }],
    } as never);

    const result = await planWeekTool(
      {
        weekStart: '2026-07-13',
        title: undefined,
        prepNotes: 'Roast 1kg chicken Sunday',
        shoppingList: ['1kg chicken breast', '500g oats'],
        meals: [
          {
            dayOfWeek: 0,
            mealType: 'lunch',
            description: 'Chicken with rice',
            kcal: undefined,
            protein: undefined,
            carbs: undefined,
            fat: undefined,
          },
        ],
      },
      ctx,
    );

    // The meals, prep notes and shopping list go to the service as one write —
    // prepNotes maps to the menu's notes column.
    expect(createWeeklyMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Roast 1kg chicken Sunday',
        shoppingList: ['1kg chicken breast', '500g oats'],
      }),
    );
    expect(replaceShoppingListItems).not.toHaveBeenCalled();

    const payload = parsePayload(result) as { prepNotes: string; shoppingListItems: number };
    expect(payload.prepNotes).toBe('Roast 1kg chicken Sunday');
    expect(payload.shoppingListItems).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// setPrepNotesTool
// ---------------------------------------------------------------------------

describe('setPrepNotesTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the notes and reports success', async () => {
    vi.mocked(updateWeeklyMenu).mockResolvedValue({ menuId: 'menu-1', notes: 'Batch cook Sunday' } as never);

    const result = await setPrepNotesTool({ menuId: 'menu-1', prepNotes: 'Batch cook Sunday' }, ctx);

    expect(updateWeeklyMenu).toHaveBeenCalledWith('user-1', 'menu-1', { notes: 'Batch cook Sunday' });
    const payload = parsePayload(result) as { success: boolean; prepNotes: string };
    expect(payload.success).toBe(true);
    expect(payload.prepNotes).toBe('Batch cook Sunday');
  });

  it('clears the notes when given an empty string', async () => {
    vi.mocked(updateWeeklyMenu).mockResolvedValue({ menuId: 'menu-1', notes: null } as never);

    await setPrepNotesTool({ menuId: 'menu-1', prepNotes: '   ' }, ctx);

    expect(updateWeeklyMenu).toHaveBeenCalledWith('user-1', 'menu-1', { notes: null });
  });

  it('returns success=false when the menu is not found', async () => {
    vi.mocked(updateWeeklyMenu).mockResolvedValue(null);

    const result = await setPrepNotesTool({ menuId: 'missing', prepNotes: 'x' }, ctx);

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// setShoppingListTool
// ---------------------------------------------------------------------------

describe('setShoppingListTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces the list and reports the item count', async () => {
    vi.mocked(replaceShoppingListItems).mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }] as never);

    const result = await setShoppingListTool(
      { menuId: 'menu-1', items: ['1kg chicken breast', '6 eggs', '500g oats'] },
      ctx,
    );

    expect(replaceShoppingListItems).toHaveBeenCalledWith('user-1', 'menu-1', [
      '1kg chicken breast',
      '6 eggs',
      '500g oats',
    ]);
    const payload = parsePayload(result) as { success: boolean; itemCount: number };
    expect(payload.success).toBe(true);
    expect(payload.itemCount).toBe(3);
  });

  it('returns success=false when the menu is not found', async () => {
    vi.mocked(replaceShoppingListItems).mockResolvedValue(null);

    const result = await setShoppingListTool({ menuId: 'missing', items: ['x'] }, ctx);

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('not found');
  });
});
