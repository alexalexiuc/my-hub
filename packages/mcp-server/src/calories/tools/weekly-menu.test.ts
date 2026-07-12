import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addMealToMenu,
  updateWeeklyMenuMeal,
  hasAccessToMenu,
  deleteWeeklyMenuMeal,
  deleteWeeklyMenu,
  createWeeklyMenu,
} from '@my-hub/shared/services';
import {
  AddMealSchema,
  SwapMealSchema,
  RemoveMenuMealSchema,
  addMealTool,
  swapMealTool,
  removeMenuMealTool,
  deleteWeeklyMenuTool,
  createWeeklyMenuTool,
} from './weekly-menu';
import { caloriesContext, parseToolPayload } from './test-utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@my-hub/shared/services', () => ({
  addMealToMenu: vi.fn(),
  updateWeeklyMenuMeal: vi.fn(),
  hasAccessToMenu: vi.fn(),
  deleteWeeklyMenuMeal: vi.fn(),
  deleteWeeklyMenu: vi.fn(),
  createWeeklyMenu: vi.fn(),
  getCalorieProfile: vi.fn(),
  getLatestMeasurementsPerType: vi.fn(),
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
// AddMealSchema validation
// ---------------------------------------------------------------------------

describe('AddMealSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = AddMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 0,
      mealType: 'pre_workout',
      description: 'Banana and shake',
      kcal: 250,
      proteinG: 30,
      carbsG: 28,
      fatG: 3,
    });
    expect(result.success).toBe(true);
  });

  it('accepts input with only required fields', () => {
    const result = AddMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 2,
      mealType: 'snack',
      description: 'Apple',
    });
    expect(result.success).toBe(true);
  });

  it('rejects dayOfWeek outside 0–6', () => {
    const result = AddMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 7,
      mealType: 'snack',
      description: 'Apple',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown mealType', () => {
    const result = AddMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 1,
      mealType: 'brunch',
      description: 'Eggs',
    });
    expect(result.success).toBe(false);
  });

  it('accepts pre_workout, post_workout and other meal types', () => {
    for (const mealType of ['pre_workout', 'post_workout', 'other']) {
      const result = AddMealSchema.safeParse({
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
// SwapMealSchema validation
// ---------------------------------------------------------------------------

describe('SwapMealSchema', () => {
  it('accepts valid swap input', () => {
    const result = SwapMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 3,
      mealType: 'dinner',
      description: 'Chicken with rice',
      kcal: 600,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing description', () => {
    const result = SwapMealSchema.safeParse({
      menuId: 'menu-xyz',
      dayOfWeek: 3,
      mealType: 'dinner',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addMealTool
// ---------------------------------------------------------------------------

describe('addMealTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success=true with the added meal and a message', async () => {
    vi.mocked(addMealToMenu).mockResolvedValue(BASE_MEAL as never);

    const result = await addMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 0,
        mealType: 'pre_workout',
        description: 'Banana and protein shake',
        kcal: 250,
        proteinG: undefined,
        carbsG: undefined,
        fatG: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; added: { mealType: string }; message: string };
    expect(payload.success).toBe(true);
    expect(payload.added.mealType).toBe('pre_workout');
    expect(payload.message).toContain('Mon');
    expect(payload.message).toContain('250 kcal');
  });

  it('returns success=false when menu not found or slot exists', async () => {
    vi.mocked(addMealToMenu).mockResolvedValue(null);

    const result = await addMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 0,
        mealType: 'breakfast',
        description: 'Duplicate',
        kcal: undefined,
        proteinG: undefined,
        carbsG: undefined,
        fatG: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toMatch(/not found|already exists/i);
  });

  it('passes kcal and macros correctly to addMealToMenu', async () => {
    vi.mocked(addMealToMenu).mockResolvedValue(BASE_MEAL as never);

    await addMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 1,
        mealType: 'snack',
        description: 'Nuts',
        kcal: 180,
        proteinG: 5,
        carbsG: 10,
        fatG: 14,
      },
      ctx,
    );

    expect(addMealToMenu).toHaveBeenCalledWith(
      'user-1',
      'menu-xyz',
      expect.objectContaining({
        kcal: 180,
        protein: 5,
        carbs: 10,
        fat: 14,
      }),
    );
  });

  it('passes null for optional fields when omitted', async () => {
    vi.mocked(addMealToMenu).mockResolvedValue(BASE_MEAL as never);

    await addMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 1,
        mealType: 'snack',
        description: 'Nuts',
        kcal: undefined,
        proteinG: undefined,
        carbsG: undefined,
        fatG: undefined,
      },
      ctx,
    );

    expect(addMealToMenu).toHaveBeenCalledWith(
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
// swapMealTool
// ---------------------------------------------------------------------------

describe('swapMealTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success=false when menu is not found', async () => {
    vi.mocked(hasAccessToMenu).mockResolvedValue(false);

    const result = await swapMealTool(
      {
        menuId: 'missing-id',
        dayOfWeek: 0,
        mealType: 'lunch',
        description: 'New meal',
        kcal: undefined,
        proteinG: undefined,
        carbsG: undefined,
        fatG: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; message: string };
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('not found');
    expect(updateWeeklyMenuMeal).not.toHaveBeenCalled();
  });

  it('returns success=false when the meal slot does not exist', async () => {
    vi.mocked(hasAccessToMenu).mockResolvedValue(true);
    vi.mocked(updateWeeklyMenuMeal).mockResolvedValue(null);

    const result = await swapMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 4,
        mealType: 'dinner',
        description: 'Something',
        kcal: undefined,
        proteinG: undefined,
        carbsG: undefined,
        fatG: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean };
    expect(payload.success).toBe(false);
  });

  it('returns success=true with the updated meal and a message', async () => {
    const updatedMeal = { ...BASE_MEAL, mealType: 'lunch', description: 'Tuna salad', kcal: 400 };
    vi.mocked(hasAccessToMenu).mockResolvedValue(true);
    vi.mocked(updateWeeklyMenuMeal).mockResolvedValue(updatedMeal as never);

    const result = await swapMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 0,
        mealType: 'lunch',
        description: 'Tuna salad',
        kcal: 400,
        proteinG: undefined,
        carbsG: undefined,
        fatG: undefined,
      },
      ctx,
    );

    const payload = parsePayload(result) as { success: boolean; updated: { description: string }; message: string };
    expect(payload.success).toBe(true);
    expect(payload.updated.description).toBe('Tuna salad');
    expect(payload.message).toContain('400 kcal');
    expect(payload.message).toContain('Mon');
  });

  it('passes the correct arguments to updateWeeklyMenuMeal', async () => {
    vi.mocked(hasAccessToMenu).mockResolvedValue(true);
    vi.mocked(updateWeeklyMenuMeal).mockResolvedValue(BASE_MEAL as never);

    await swapMealTool(
      {
        menuId: 'menu-xyz',
        dayOfWeek: 2,
        mealType: 'dinner',
        description: 'Steak',
        kcal: 700,
        proteinG: 60,
        carbsG: 10,
        fatG: 30,
      },
      ctx,
    );

    expect(updateWeeklyMenuMeal).toHaveBeenCalledWith(
      'user-1',
      'menu-xyz',
      2,
      'dinner',
      expect.objectContaining({
        description: 'Steak',
        kcal: 700,
        protein: 60,
        carbs: 10,
        fat: 30,
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
// createWeeklyMenuTool — duplicate-slot rejection
// ---------------------------------------------------------------------------

describe('createWeeklyMenuTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate (dayOfWeek, mealType) slots instead of silently dropping meals', async () => {
    const meal = {
      dayOfWeek: 0,
      mealType: 'lunch',
      kcal: undefined,
      proteinG: undefined,
      carbsG: undefined,
      fatG: undefined,
    } as const;

    const result = await createWeeklyMenuTool(
      {
        weekStart: '2026-07-13',
        title: undefined,
        notes: undefined,
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
});
