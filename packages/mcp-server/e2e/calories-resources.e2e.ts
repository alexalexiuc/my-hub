import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, type McpClient } from './helpers/mcp-client.js';

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
  latestMeasurements: {
    type: string;
    label: string;
    value: number;
    unit: string;
    date: string;
  }[];
}

function parseResourceContent<T>(text: string): T {
  return JSON.parse(text) as T;
}

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
    const data = parseResourceContent<ProfileResource>(raw!.text as string);

    expect(typeof data.profile).toBe('object');
    expect(typeof data.calculated).toBe('object');
    expect('tdee' in data.calculated).toBe(true);
    expect('goalCalories' in data.calculated).toBe(true);
    expect('minCalories' in data.calculated).toBe(true);
    expect('maxCalories' in data.calculated).toBe(true);
    expect(Array.isArray(data.latestMeasurements)).toBe(true);
  });

  it('calories://profile latestMeasurements entries have required fields', async () => {
    const result = await client.readResource({ uri: 'calories://profile' });
    const raw = result.contents[0];
    const data = parseResourceContent<ProfileResource>(raw!.text as string);

    for (const m of data.latestMeasurements) {
      expect(typeof m.type).toBe('string');
      expect(typeof m.label).toBe('string');
      expect(typeof m.value).toBe('number');
      expect(typeof m.unit).toBe('string');
      expect(typeof m.date).toBe('string');
    }
  });

  it('calories://today returns a valid daily summary structure', async () => {
    const result = await client.readResource({ uri: 'calories://today' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = parseResourceContent<DailySummaryResource>(raw!.text as string);

    expect(typeof data.date).toBe('string');
    expect(Array.isArray(data.meals)).toBe(true);
    expect(typeof data.totals).toBe('object');
    expect(typeof data.totals.calories).toBe('number');
    expect(typeof data.totals.mealCount).toBe('number');
    expect(data.totals.proteinG === null || typeof data.totals.proteinG === 'number').toBe(true);
    expect(data.totals.carbsG === null || typeof data.totals.carbsG === 'number').toBe(true);
    expect(data.totals.fatG === null || typeof data.totals.fatG === 'number').toBe(true);
  });

  it('calories://today goal fields are null or numeric', async () => {
    const result = await client.readResource({ uri: 'calories://today' });
    const raw = result.contents[0];
    const data = parseResourceContent<DailySummaryResource>(raw!.text as string);

    expect(data.goalCalories === null || typeof data.goalCalories === 'number').toBe(true);
    expect(data.minCalories === null || typeof data.minCalories === 'number').toBe(true);
    expect(data.maxCalories === null || typeof data.maxCalories === 'number').toBe(true);
    expect(data.remainingCalories === null || typeof data.remainingCalories === 'number').toBe(true);
    expect(data.overBudget === null || typeof data.overBudget === 'boolean').toBe(true);
    expect(data.goalMet === null || typeof data.goalMet === 'boolean').toBe(true);
  });

  it('calories://history-7days returns exactly 7 days', async () => {
    const result = await client.readResource({ uri: 'calories://history-7days' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = parseResourceContent<HistoryPeriodResource>(raw!.text as string);

    expect(typeof data.period.start).toBe('string');
    expect(typeof data.period.end).toBe('string');
    expect(Array.isArray(data.days)).toBe(true);
    expect(data.days).toHaveLength(7);
    expect(Array.isArray(data.weightLogs)).toBe(true);
    expect(typeof data.totalCalories).toBe('number');
    expect(typeof data.averageDailyCalories).toBe('number');
  });

  it('calories://history-7days days are ordered chronologically', async () => {
    const result = await client.readResource({ uri: 'calories://history-7days' });
    const raw = result.contents[0];
    const data = parseResourceContent<HistoryPeriodResource>(raw!.text as string);

    for (let i = 1; i < data.days.length; i++) {
      expect(data.days[i]!.date > data.days[i - 1]!.date).toBe(true);
    }
  });

  it('calories://history-30days returns exactly 30 days', async () => {
    const result = await client.readResource({ uri: 'calories://history-30days' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = parseResourceContent<HistoryPeriodResource>(raw!.text as string);

    expect(Array.isArray(data.days)).toBe(true);
    expect(data.days).toHaveLength(30);
    expect(typeof data.totalCalories).toBe('number');
    expect(typeof data.averageDailyCalories).toBe('number');
    expect(data.periodTarget === null || typeof data.periodTarget === 'number').toBe(true);
    expect(data.periodRemaining === null || typeof data.periodRemaining === 'number').toBe(true);
  });
});
