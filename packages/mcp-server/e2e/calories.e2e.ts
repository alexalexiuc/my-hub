import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface MealEntry {
  meal_id: string;
  date: string;
  meal_type: string;
  description: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  created_at: string;
}

interface GetMealsResult {
  entries: MealEntry[];
  total_count: number;
  has_more: boolean;
  next_offset: number | null;
}

interface LogMealResult {
  meal_id: string;
  date: string;
  meal_type: string;
  description: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

interface DeleteMealResult {
  deleted: boolean;
  meal_id: string;
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

  // Use a far-future date to avoid colliding with real meal data.
  // The server only validates YYYY-MM-DD format, not that the date is in the past.
  const testDate = '2099-01-01';
  const runId = Date.now().toString(36);
  const mealDescription = `[e2e:${runId}] Grilled chicken with rice and salad`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/mcp/calories', token);
  });

  afterAll(async () => {
    // Best-effort cleanup: delete the test meal if it was logged but not yet deleted.
    if (mealId) {
      try {
        await client.callTool({ name: 'calories_delete_meal', arguments: { meal_id: mealId } });
      } catch {
        // Ignore — meal may already be deleted by a test.
      }
    }
    await client.close();
  });

  it('logs a meal and returns a meal_id', async () => {
    const result = await client.callTool({
      name: 'calories_log_meal',
      arguments: {
        description: mealDescription,
        calories: 550,
        meal_type: 'lunch',
        date: testDate,
        protein_g: 42,
        carbs_g: 60,
        fat_g: 12,
        notes: 'e2e test meal — safe to delete',
      },
    });

    const data = parseToolResult<LogMealResult>(result);

    expect(data.meal_id).toBeTruthy();
    expect(data.date).toBe(testDate);
    expect(data.meal_type).toBe('lunch');
    expect(data.description).toBe(mealDescription);
    expect(data.calories).toBe(550);
    expect(data.protein_g).toBe(42);
    expect(data.carbs_g).toBe(60);
    expect(data.fat_g).toBe(12);

    mealId = data.meal_id;
  });

  it('retrieves the logged meal with correct data', async () => {
    expect(mealId).toBeTruthy();

    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate },
    });

    const data = parseToolResult<GetMealsResult>(result);

    expect(Array.isArray(data.entries)).toBe(true);
    expect(typeof data.total_count).toBe('number');

    const meal = data.entries.find((e) => e.meal_id === mealId);
    expect(meal).toBeDefined();
    expect(meal!.description).toBe(mealDescription);
    expect(meal!.calories).toBe(550);
    expect(meal!.meal_type).toBe('lunch');
    expect(meal!.date).toBe(testDate);
    expect(meal!.protein_g).toBe(42);
    expect(meal!.carbs_g).toBe(60);
    expect(meal!.fat_g).toBe(12);
    expect(meal!.created_at).toBeTruthy();
  });

  it('filters meals by meal_type', async () => {
    const result = await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: testDate, meal_type: 'breakfast' },
    });

    const data = parseToolResult<GetMealsResult>(result);
    const hasTestMeal = data.entries.some((e) => e.meal_id === mealId);
    // Our test meal is 'lunch', so it should not appear in breakfast results.
    expect(hasTestMeal).toBe(false);
  });

  it('deletes the logged meal', async () => {
    expect(mealId).toBeTruthy();

    const result = await client.callTool({
      name: 'calories_delete_meal',
      arguments: { meal_id: mealId },
    });

    const data = parseToolResult<DeleteMealResult>(result);
    expect(data.deleted).toBe(true);
    expect(data.meal_id).toBe(mealId);

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
    const found = data.entries.find((e) => e.description === mealDescription);
    expect(found).toBeUndefined();
  });

  it('returns an error when deleting a non-existent meal', async () => {
    const result = await client.callTool({
      name: 'calories_delete_meal',
      arguments: { meal_id: 'non-existent-meal-id-00000000' },
    });

    // Tools signal errors by setting isError: true on the response.
    expect(result.isError).toBe(true);
  });
});
