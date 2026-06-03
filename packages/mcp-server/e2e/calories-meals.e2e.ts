import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface LoggedMeal {
  mealId: string;
  date: string;
  mealType: string;
  description: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

interface MacroRemaining {
  proteinG: number;
  carbsG: number;
  fatG: number;
  goalProteinG: number | null;
  goalCarbsG: number | null;
  goalFatG: number | null;
  remainingProteinG: number | null;
  remainingCarbsG: number | null;
  remainingFatG: number | null;
  overProtein: boolean | null;
  overCarbs: boolean | null;
  overFat: boolean | null;
}

interface RemainingInfo {
  caloriesConsumed: number;
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  remainingCalories: number | null;
  overBudget: boolean | null;
  macros: MacroRemaining;
}

interface LogMealResult {
  meals: LoggedMeal[];
  remaining: RemainingInfo;
}

interface MealEntry {
  mealId: string;
  date: string;
  mealType: string;
  description: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  createdAt: string;
}

interface GetMealsResult {
  entries: MealEntry[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number | null;
}

interface DeleteMealResult {
  deleted: boolean;
  mealId: string;
}

/**
 * E2e tests for calories meal tools.
 *
 * Full lifecycle: log_meal → get_meals → delete_meal → verify gone.
 * Uses a far-future date (2099-01-01) so test data does not pollute real logs.
 * A unique runId identifies test artefacts across parallel runs.
 */
describe.sequential('calories — meal lifecycle', () => {
  let client: McpClient;
  let mealId: string | undefined;
  const itemMealIds: string[] = [];

  const testDate = '2099-01-01';
  const runId = Date.now().toString(36);
  const mealDescription = `[e2e:${runId}] Grilled chicken with rice and salad`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
  });

  afterAll(async () => {
    const idsToClean = [...(mealId ? [mealId] : []), ...itemMealIds];
    for (const id of idsToClean) {
      try {
        await client.callTool({ name: 'calories_delete_meal', arguments: { mealId: id } });
      } catch {
        // already deleted
      }
    }
    await client.close();
  });

  it('logs a single meal and returns meals array with remaining info', async () => {
    const result = await client.callTool({
      name: 'calories_log_meal',
      arguments: {
        description: mealDescription,
        calories: 550,
        mealType: 'lunch',
        date: testDate,
        proteinG: 42,
        carbsG: 60,
        fatG: 12,
        notes: 'e2e test meal — safe to delete',
      },
    });

    const data = parseToolResult<LogMealResult>(result);

    expect(Array.isArray(data.meals)).toBe(true);
    expect(data.meals).toHaveLength(1);

    const meal = data.meals[0]!;
    expect(meal.mealId).toBeTruthy();
    expect(meal.date).toBe(testDate);
    expect(meal.mealType).toBe('lunch');
    expect(meal.description).toBe(mealDescription);
    expect(meal.calories).toBe(550);
    expect(meal.proteinG).toBe(42);
    expect(meal.carbsG).toBe(60);
    expect(meal.fatG).toBe(12);

    mealId = meal.mealId;
  });

  it('remaining info has the correct shape', async () => {
    const result = await client.callTool({
      name: 'calories_log_meal',
      arguments: {
        description: `[e2e:${runId}] shape check`,
        calories: 100,
        mealType: 'snack',
        date: testDate,
      },
    });

    const data = parseToolResult<LogMealResult>(result);
    const r = data.remaining;

    expect(typeof r.caloriesConsumed).toBe('number');
    expect(r.goalCalories === null || typeof r.goalCalories === 'number').toBe(true);
    expect(r.minCalories === null || typeof r.minCalories === 'number').toBe(true);
    expect(r.maxCalories === null || typeof r.maxCalories === 'number').toBe(true);
    expect(r.remainingCalories === null || typeof r.remainingCalories === 'number').toBe(true);
    expect(r.overBudget === null || typeof r.overBudget === 'boolean').toBe(true);

    expect(typeof r.macros).toBe('object');
    expect(typeof r.macros.proteinG).toBe('number');
    expect(typeof r.macros.carbsG).toBe('number');
    expect(typeof r.macros.fatG).toBe('number');

    // Delete this one-off shape-check meal
    const shapeCheckId = data.meals[0]?.mealId;
    if (shapeCheckId) {
      await client.callTool({ name: 'calories_delete_meal', arguments: { mealId: shapeCheckId } });
    }
  });

  it('logs a meal with multiple items and returns one entry per item', async () => {
    const result = await client.callTool({
      name: 'calories_log_meal',
      arguments: {
        description: `[e2e:${runId}] Burger meal`,
        calories: 900,
        mealType: 'dinner',
        date: testDate,
        items: [
          { name: `[e2e:${runId}] Burger`, calories: 600, proteinG: 30, fatG: 25 },
          { name: `[e2e:${runId}] Fries`, calories: 300, carbsG: 40 },
        ],
      },
    });

    const data = parseToolResult<LogMealResult>(result);

    expect(Array.isArray(data.meals)).toBe(true);
    expect(data.meals).toHaveLength(2);

    const [burger, fries] = [data.meals[0]!, data.meals[1]!];
    expect(burger.mealId).toBeTruthy();
    expect(burger.description).toBe(`[e2e:${runId}] Burger`);
    expect(burger.calories).toBe(600);
    expect(burger.proteinG).toBe(30);
    expect(burger.fatG).toBe(25);
    expect(burger.mealType).toBe('dinner');

    expect(fries.mealId).toBeTruthy();
    expect(fries.description).toBe(`[e2e:${runId}] Fries`);
    expect(fries.calories).toBe(300);
    expect(fries.carbsG).toBe(40);

    expect(data.remaining.caloriesConsumed).toBeGreaterThanOrEqual(900);

    itemMealIds.push(burger.mealId, fries.mealId);
  });

  it('retrieves the logged meal by date with correct data', async () => {
    expect(mealId).toBeTruthy();

    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate },
    });

    const data = parseToolResult<GetMealsResult>(result);

    expect(Array.isArray(data.entries)).toBe(true);
    expect(typeof data.totalCount).toBe('number');
    expect(typeof data.hasMore).toBe('boolean');
    expect(data.nextOffset === null || typeof data.nextOffset === 'number').toBe(true);

    const meal = data.entries.find(e => e.mealId === mealId);
    expect(meal).toBeDefined();
    expect(meal!.description).toBe(mealDescription);
    expect(meal!.calories).toBe(550);
    expect(meal!.mealType).toBe('lunch');
    expect(meal!.date).toBe(testDate);
    expect(meal!.proteinG).toBe(42);
    expect(meal!.carbsG).toBe(60);
    expect(meal!.fatG).toBe(12);
    expect(typeof meal!.createdAt).toBe('string');
  });

  it('filters meals by mealType — lunch meal does not appear in breakfast results', async () => {
    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate, mealType: 'breakfast' },
    });

    const data = parseToolResult<GetMealsResult>(result);
    const hasTestMeal = data.entries.some(e => e.mealId === mealId);
    expect(hasTestMeal).toBe(false);
  });

  it('returns paginated results with correct metadata', async () => {
    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate, limit: 1, offset: 0 },
    });

    const data = parseToolResult<GetMealsResult>(result);
    expect(data.entries).toHaveLength(1);
    expect(data.totalCount).toBeGreaterThanOrEqual(1);
    if (data.totalCount > 1) {
      expect(data.hasMore).toBe(true);
      expect(data.nextOffset).toBe(1);
    }
  });

  it('deletes the logged meal successfully', async () => {
    expect(mealId).toBeTruthy();

    const result = await client.callTool({
      name: 'calories_delete_meal',
      arguments: { mealId },
    });

    const data = parseToolResult<DeleteMealResult>(result);
    expect(data.deleted).toBe(true);
    expect(data.mealId).toBe(mealId);

    mealId = undefined;
  });

  it('deleted meal is no longer present when fetching by date', async () => {
    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate },
    });

    const data = parseToolResult<GetMealsResult>(result);
    const found = data.entries.find(e => e.description === mealDescription);
    expect(found).toBeUndefined();
  });

  it('returns an error when deleting a non-existent meal', async () => {
    const result = await client.callTool({
      name: 'calories_delete_meal',
      arguments: { mealId: 'non-existent-meal-id-00000000' },
    });

    expect(result.isError).toBe(true);
  });
});
