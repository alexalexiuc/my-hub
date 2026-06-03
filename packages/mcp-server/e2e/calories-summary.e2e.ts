import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface DailyTotals {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  mealCount: number;
}

interface DailySummary {
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

interface WeightLog {
  date: string;
  value: number;
  unit: string;
}

interface HistoryPeriod {
  period: { start: string; end: string };
  days: HistoryDay[];
  weightLogs: WeightLog[];
  totalCalories: number;
  averageDailyCalories: number;
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  periodTarget: number | null;
  periodRemaining: number | null;
}

describe.sequential('calories — get_daily_summary', () => {
  let client: McpClient;
  const testDate = '2099-02-01';
  const mealIdsToCleanup: string[] = [];

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);

    // Seed a known meal on testDate so totals are non-zero.
    const result = await client.callTool({
      name: 'calories_log_meal',
      arguments: {
        description: '[e2e:summary] Seeded meal',
        calories: 400,
        mealType: 'lunch',
        date: testDate,
        proteinG: 30,
        carbsG: 40,
        fatG: 10,
      },
    });
    const raw = JSON.parse((result.content[0] as { text: string }).text);
    const seededId = raw.meals?.[0]?.mealId as string | undefined;
    if (seededId) mealIdsToCleanup.push(seededId);
  });

  afterAll(async () => {
    for (const id of mealIdsToCleanup) {
      try {
        await client.callTool({ name: 'calories_delete_meal', arguments: { mealId: id } });
      } catch {
        // already deleted
      }
    }
    await client.close();
  });

  it('returns a valid daily summary structure', async () => {
    const result = await client.callTool({
      name: 'calories_get_daily_summary',
      arguments: { date: testDate },
    });

    const data = parseToolResult<DailySummary>(result);

    expect(data.date).toBe(testDate);
    expect(Array.isArray(data.meals)).toBe(true);
    expect(typeof data.totals).toBe('object');
    expect(typeof data.totals.calories).toBe('number');
    expect(typeof data.totals.mealCount).toBe('number');
    expect(data.totals.proteinG === null || typeof data.totals.proteinG === 'number').toBe(true);
    expect(data.totals.carbsG === null || typeof data.totals.carbsG === 'number').toBe(true);
    expect(data.totals.fatG === null || typeof data.totals.fatG === 'number').toBe(true);
  });

  it('totals reflect the seeded meal', async () => {
    const result = await client.callTool({
      name: 'calories_get_daily_summary',
      arguments: { date: testDate },
    });

    const data = parseToolResult<DailySummary>(result);

    expect(data.totals.calories).toBeGreaterThanOrEqual(400);
    expect(data.totals.mealCount).toBeGreaterThanOrEqual(1);
  });

  it('goal fields are null or numeric', async () => {
    const result = await client.callTool({
      name: 'calories_get_daily_summary',
      arguments: { date: testDate },
    });

    const data = parseToolResult<DailySummary>(result);

    expect(data.goalCalories === null || typeof data.goalCalories === 'number').toBe(true);
    expect(data.minCalories === null || typeof data.minCalories === 'number').toBe(true);
    expect(data.maxCalories === null || typeof data.maxCalories === 'number').toBe(true);
    expect(data.remainingCalories === null || typeof data.remainingCalories === 'number').toBe(true);
    expect(data.overBudget === null || typeof data.overBudget === 'boolean').toBe(true);
    expect(data.goalMet === null || typeof data.goalMet === 'boolean').toBe(true);
  });

  it('empty date returns zero totals and empty meals array', async () => {
    const result = await client.callTool({
      name: 'calories_get_daily_summary',
      arguments: { date: '2099-12-31' },
    });

    const data = parseToolResult<DailySummary>(result);

    expect(data.date).toBe('2099-12-31');
    expect(data.meals).toHaveLength(0);
    expect(data.totals.calories).toBe(0);
    expect(data.totals.mealCount).toBe(0);
  });
});

describe.sequential('calories — get_history', () => {
  let client: McpClient;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('returns a history period with the correct date range and shape', async () => {
    const result = await client.callTool({
      name: 'calories_get_history',
      arguments: { startDate: '2099-01-01', endDate: '2099-01-07' },
    });

    const data = parseToolResult<HistoryPeriod>(result);

    expect(data.period.start).toBe('2099-01-01');
    expect(data.period.end).toBe('2099-01-07');
    expect(Array.isArray(data.days)).toBe(true);
    expect(data.days).toHaveLength(7);
    expect(Array.isArray(data.weightLogs)).toBe(true);
    expect(typeof data.totalCalories).toBe('number');
    expect(typeof data.averageDailyCalories).toBe('number');
  });

  it('each day entry has required fields', async () => {
    const result = await client.callTool({
      name: 'calories_get_history',
      arguments: { startDate: '2099-01-01', endDate: '2099-01-03' },
    });

    const data = parseToolResult<HistoryPeriod>(result);

    expect(data.days).toHaveLength(3);
    for (const day of data.days) {
      expect(typeof day.date).toBe('string');
      expect(typeof day.calories).toBe('number');
      expect(typeof day.mealCount).toBe('number');
    }
  });

  it('days are ordered chronologically', async () => {
    const result = await client.callTool({
      name: 'calories_get_history',
      arguments: { startDate: '2099-01-01', endDate: '2099-01-05' },
    });

    const data = parseToolResult<HistoryPeriod>(result);

    for (let i = 1; i < data.days.length; i++) {
      expect(data.days[i]!.date > data.days[i - 1]!.date).toBe(true);
    }
  });

  it('goal and period fields are null or numeric', async () => {
    const result = await client.callTool({
      name: 'calories_get_history',
      arguments: { startDate: '2099-01-01', endDate: '2099-01-07' },
    });

    const data = parseToolResult<HistoryPeriod>(result);

    expect(data.goalCalories === null || typeof data.goalCalories === 'number').toBe(true);
    expect(data.minCalories === null || typeof data.minCalories === 'number').toBe(true);
    expect(data.maxCalories === null || typeof data.maxCalories === 'number').toBe(true);
    expect(data.periodTarget === null || typeof data.periodTarget === 'number').toBe(true);
    expect(data.periodRemaining === null || typeof data.periodRemaining === 'number').toBe(true);
  });

  it('single-day range returns exactly one day', async () => {
    const result = await client.callTool({
      name: 'calories_get_history',
      arguments: { startDate: '2099-03-01', endDate: '2099-03-01' },
    });

    const data = parseToolResult<HistoryPeriod>(result);

    expect(data.days).toHaveLength(1);
    expect(data.days[0]!.date).toBe('2099-03-01');
  });
});
