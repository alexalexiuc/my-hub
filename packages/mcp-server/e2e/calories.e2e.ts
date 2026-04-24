import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

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

interface RemainingInfo {
  caloriesConsumed: number;
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  remainingCalories: number | null;
  overBudget: boolean | null;
}

interface LogMealResult {
  meals: LoggedMeal[];
  remaining: RemainingInfo;
}

interface DeleteMealResult {
  deleted: boolean;
  mealId: string;
}

/**
 * E2e tests for the calories MCP sub-server.
 *
 * These tests exercise the full meal lifecycle via the MCP protocol:
 *   log meal → retrieve meals → verify data → delete meal → verify gone
 *
 * A unique run ID is embedded in the meal description so test meals can be
 * identified among real data without relying on a test-only database.
 */
describe.sequential('calories — meal lifecycle', () => {
  let client: McpClient;
  let mealId: string | undefined;
  const itemMealIds: string[] = [];

  // Use a far-future date to avoid colliding with real meal data.
  // The server only validates YYYY-MM-DD format, not that the date is in the past.
  const testDate = '2099-01-01';
  const runId = Date.now().toString(36);
  const mealDescription = `[e2e:${runId}] Grilled chicken with rice and salad`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
  });

  afterAll(async () => {
    // Best-effort cleanup: delete test meals if not yet deleted.
    const idsToClean = [...(mealId ? [mealId] : []), ...itemMealIds];
    for (const id of idsToClean) {
      try {
        await client.callTool({ name: 'calories_delete_meal', arguments: { mealId: id } });
      } catch {
        // Ignore — meal may already be deleted by a test.
      }
    }
    await client.close();
  });

  it('logs a meal and returns meals array with remaining info', async () => {
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

    expect(data.remaining).toBeDefined();
    expect(typeof data.remaining.caloriesConsumed).toBe('number');

    mealId = meal.mealId;
  });

  it('logs a meal with multiple items and returns one entry per item', async () => {
    const result = await client.callTool({
      name: 'calories_log_meal',
      arguments: {
        description: `[e2e:${runId}] Burger meal`,
        calories: 900,
        mealType: 'lunch',
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

    expect(fries.mealId).toBeTruthy();
    expect(fries.description).toBe(`[e2e:${runId}] Fries`);
    expect(fries.calories).toBe(300);
    expect(fries.carbsG).toBe(40);

    expect(data.remaining).toBeDefined();
    expect(typeof data.remaining.caloriesConsumed).toBe('number');

    itemMealIds.push(burger.mealId, fries.mealId);
  });

  it('retrieves the logged meal with correct data', async () => {
    expect(mealId).toBeTruthy();

    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate },
    });

    const data = parseToolResult<GetMealsResult>(result);

    expect(Array.isArray(data.entries)).toBe(true);
    expect(typeof data.totalCount).toBe('number');

    const meal = data.entries.find(e => e.mealId === mealId);
    expect(meal).toBeDefined();
    expect(meal!.description).toBe(mealDescription);
    expect(meal!.calories).toBe(550);
    expect(meal!.mealType).toBe('lunch');
    expect(meal!.date).toBe(testDate);
    expect(meal!.proteinG).toBe(42);
    expect(meal!.carbsG).toBe(60);
    expect(meal!.fatG).toBe(12);
    expect(meal!.createdAt).toBeTruthy();
  });

  it('filters meals by mealType', async () => {
    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate, mealType: 'breakfast' },
    });

    const data = parseToolResult<GetMealsResult>(result);
    const hasTestMeal = data.entries.some(e => e.mealId === mealId);
    // Our test meal is 'lunch', so it should not appear in breakfast results.
    expect(hasTestMeal).toBe(false);
  });

  it('deletes the logged meal', async () => {
    expect(mealId).toBeTruthy();

    const result = await client.callTool({
      name: 'calories_delete_meal',
      arguments: { mealId },
    });

    const data = parseToolResult<DeleteMealResult>(result);
    expect(data.deleted).toBe(true);
    expect(data.mealId).toBe(mealId);

    // Clear so afterAll cleanup skips it.
    mealId = undefined;
  });

  it('meal is no longer present after deletion', async () => {
    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate },
    });

    const data = parseToolResult<GetMealsResult>(result);
    // mealId was already cleared above; re-use the run-scoped description to identify
    const found = data.entries.find(e => e.description === mealDescription);
    expect(found).toBeUndefined();
  });

  it('returns an error when deleting a non-existent meal', async () => {
    const result = await client.callTool({
      name: 'calories_delete_meal',
      arguments: { mealId: 'non-existent-meal-id-00000000' },
    });

    // Tools signal errors by setting isError: true on the response.
    expect(result.isError).toBe(true);
  });
});

interface DailyTotals {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  mealCount: number;
}

interface DailySummaryResource {
  date: string;
  meals: unknown[];
  totals: DailyTotals;
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  remainingCalories: number | null;
  overBudget: boolean | null;
  goalMet: boolean | null;
}

interface HistoryDay {
  date: string;
  calories: number;
  mealCount: number;
}

interface HistoryPeriodResource {
  period: { start: string; end: string };
  days: HistoryDay[];
  weightLogs: unknown[];
  totalCalories: number;
  averageDailyCalories: number;
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  periodTarget: number | null;
  periodRemaining: number | null;
}

interface ProfileResource {
  profile: Record<string, unknown>;
  calculated: {
    tdee: number | null;
    goalCalories: number | null;
    minCalories: number | null;
    maxCalories: number | null;
  };
  latestMeasurements: unknown[];
}

/**
 * E2e tests for the calories MCP resources.
 * These verify the shape and structure of all four calories:// resources.
 */
describe.sequential('calories — resources', () => {
  let client: McpClient;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('calories://profile returns a valid structure', async () => {
    const result = await client.readResource({ uri: 'calories://profile' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as ProfileResource;

    expect(typeof data.profile).toBe('object');
    expect(typeof data.calculated).toBe('object');
    expect(Array.isArray(data.latestMeasurements)).toBe(true);
    expect('tdee' in data.calculated).toBe(true);
    expect('goalCalories' in data.calculated).toBe(true);
  });

  it('calories://today returns a valid daily summary structure', async () => {
    const result = await client.readResource({ uri: 'calories://today' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as DailySummaryResource;

    expect(typeof data.date).toBe('string');
    expect(Array.isArray(data.meals)).toBe(true);
    expect(typeof data.totals).toBe('object');
    expect(typeof data.totals.calories).toBe('number');
    expect(typeof data.totals.mealCount).toBe('number');
  });

  it('calories://history-7days returns 7 days of data', async () => {
    const result = await client.readResource({ uri: 'calories://history-7days' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as HistoryPeriodResource;

    expect(typeof data.period.start).toBe('string');
    expect(typeof data.period.end).toBe('string');
    expect(Array.isArray(data.days)).toBe(true);
    expect(data.days).toHaveLength(7);
    expect(Array.isArray(data.weightLogs)).toBe(true);
    expect(typeof data.totalCalories).toBe('number');
    expect(typeof data.averageDailyCalories).toBe('number');
  });

  it('calories://history-30days returns 30 days of data', async () => {
    const result = await client.readResource({ uri: 'calories://history-30days' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as HistoryPeriodResource;

    expect(Array.isArray(data.days)).toBe(true);
    expect(data.days).toHaveLength(30);
    expect(typeof data.totalCalories).toBe('number');
    expect(typeof data.averageDailyCalories).toBe('number');
  });
});
