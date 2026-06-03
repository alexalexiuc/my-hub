import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface CalculatedTargets {
  tdee: number | null;
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
}

interface ProfileData {
  age?: number;
  sex?: string;
  heightCm?: number;
  activityLevel?: string;
  goalType?: string;
  goalWeeklyRateKg?: number;
  goalMinCalories?: number | null;
  goalMaxCalories?: number | null;
  notes?: string;
}

interface UpdateProfileResult {
  profile: ProfileData;
  calculated: CalculatedTargets;
}

interface LogMeasurementResult {
  id: number;
}

describe.sequential('calories — profile update', () => {
  let client: McpClient;
  let seededWeightId: number | undefined;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);

    // Seed a weight measurement so TDEE can be computed. TDEE requires age, sex,
    // height, activity level, AND a current weight reading.
    const weightResult = await client.callTool({
      name: 'calories_log_measurement',
      arguments: { type: 'weight', value: 80, date: '2099-06-01' },
    });
    const weightData = parseToolResult<LogMeasurementResult>(weightResult);
    seededWeightId = weightData.id;
  });

  afterAll(async () => {
    if (seededWeightId !== undefined) {
      try {
        await client.callTool({ name: 'calories_delete_measurement', arguments: { id: seededWeightId } });
      } catch {
        // already deleted
      }
    }
    await client.close();
  });

  it('sets demographic fields and returns profile with calculated targets', async () => {
    const result = await client.callTool({
      name: 'calories_update_profile',
      arguments: {
        age: 30,
        sex: 'male',
        heightCm: 180,
        activityLevel: 'moderately_active',
        goalType: 'maintain',
      },
    });

    const data = parseToolResult<UpdateProfileResult>(result);

    expect(typeof data.profile).toBe('object');
    expect(data.profile.age).toBe(30);
    expect(data.profile.sex).toBe('male');
    expect(data.profile.heightCm).toBe(180);
    expect(data.profile.activityLevel).toBe('moderately_active');
    expect(data.profile.goalType).toBe('maintain');

    expect(typeof data.calculated).toBe('object');
    expect(data.calculated.tdee === null || typeof data.calculated.tdee === 'number').toBe(true);
    expect(data.calculated.goalCalories === null || typeof data.calculated.goalCalories === 'number').toBe(true);
  });

  it('TDEE is computed (non-null) when age, sex, height, weight, and activity are set', async () => {
    const result = await client.callTool({
      name: 'calories_update_profile',
      arguments: {
        age: 30,
        sex: 'male',
        heightCm: 180,
        activityLevel: 'moderately_active',
        goalType: 'maintain',
      },
    });

    const data = parseToolResult<UpdateProfileResult>(result);
    expect(data.calculated.tdee).not.toBeNull();
    expect(data.calculated.tdee).toBeGreaterThan(0);
    expect(data.calculated.goalCalories).not.toBeNull();
  });

  it('weight_loss goal computes a calorie target below TDEE', async () => {
    const result = await client.callTool({
      name: 'calories_update_profile',
      arguments: {
        age: 30,
        sex: 'male',
        heightCm: 180,
        activityLevel: 'moderately_active',
        goalType: 'weight_loss',
        goalWeeklyRateKg: 0.5,
      },
    });

    const data = parseToolResult<UpdateProfileResult>(result);
    expect(data.profile.goalType).toBe('weight_loss');
    expect(data.calculated.tdee).not.toBeNull();
    expect(data.calculated.goalCalories).not.toBeNull();
    expect(data.calculated.goalCalories!).toBeLessThan(data.calculated.tdee!);
  });

  it('weight_gain goal computes a calorie target above TDEE', async () => {
    const result = await client.callTool({
      name: 'calories_update_profile',
      arguments: {
        age: 30,
        sex: 'male',
        heightCm: 180,
        activityLevel: 'moderately_active',
        goalType: 'weight_gain',
        goalWeeklyRateKg: 0.3,
      },
    });

    const data = parseToolResult<UpdateProfileResult>(result);
    expect(data.profile.goalType).toBe('weight_gain');
    expect(data.calculated.goalCalories).not.toBeNull();
    expect(data.calculated.goalCalories!).toBeGreaterThan(data.calculated.tdee!);
  });

  it('sets explicit calorie overrides and macro targets', async () => {
    const result = await client.callTool({
      name: 'calories_update_profile',
      arguments: {
        goalMaxCalories: 2000,
        goalMinCalories: 1500,
        goalProteinG: 150,
        goalCarbsG: 200,
        goalFatG: 65,
      },
    });

    const data = parseToolResult<UpdateProfileResult>(result);
    expect(data.profile.goalMaxCalories).toBe(2000);
    expect(data.profile.goalMinCalories).toBe(1500);
    expect(data.calculated.maxCalories).toBe(2000);
    expect(data.calculated.minCalories).toBe(1500);
  });

  it('saves optional notes field', async () => {
    const notes = 'e2e test — calorie tracking for fitness goal';
    const result = await client.callTool({
      name: 'calories_update_profile',
      arguments: { notes },
    });

    const data = parseToolResult<UpdateProfileResult>(result);
    expect(data.profile.notes).toBe(notes);
  });
});
