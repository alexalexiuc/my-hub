import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface MeasurementEntry {
  id: number;
  type: string;
  label: string;
  value: number;
  unit: string;
  date: string;
  notes: string | null;
}

interface LogMeasurementResult {
  id: number;
  type: string;
  label: string;
  value: number;
  unit: string;
  date: string;
  previousMeasurement: MeasurementEntry | null;
}

interface GetMeasurementsResult {
  entries: MeasurementEntry[];
  count: number;
}

interface DeleteMeasurementResult {
  deleted: boolean;
  id: number;
}

interface MeasurementTypeEntry {
  key: string;
  label: string;
  unit: string;
}

describe.sequential('calories — measurement types', () => {
  let client: McpClient;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('returns a non-empty list of measurement types with required fields', async () => {
    const result = await client.callTool({
      name: 'calories_get_measurement_types',
      arguments: {},
    });

    const data = parseToolResult<MeasurementTypeEntry[]>(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const first = data[0]!;
    expect(typeof first.key).toBe('string');
    expect(typeof first.label).toBe('string');
    expect(typeof first.unit).toBe('string');
  });

  it('includes "weight" and "height" measurement types', async () => {
    const result = await client.callTool({
      name: 'calories_get_measurement_types',
      arguments: {},
    });

    const data = parseToolResult<MeasurementTypeEntry[]>(result);
    const keys = data.map(t => t.key);

    expect(keys).toContain('weight');
    expect(keys).toContain('height');
  });
});

/**
 * Full measurement lifecycle: log → get → delete → verify gone.
 * Uses weight measurements with a far-future date to avoid polluting real data.
 */
describe.sequential('calories — measurement lifecycle', () => {
  let client: McpClient;
  let loggedId: number | undefined;
  let secondLoggedId: number | undefined;

  const testDate = '2099-01-01';
  const testDate2 = '2099-01-02';

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
  });

  afterAll(async () => {
    for (const id of [loggedId, secondLoggedId]) {
      if (id !== undefined) {
        try {
          await client.callTool({ name: 'calories_delete_measurement', arguments: { id } });
        } catch {
          // already deleted
        }
      }
    }
    await client.close();
  });

  it('logs a weight measurement and returns the correct shape', async () => {
    const result = await client.callTool({
      name: 'calories_log_measurement',
      arguments: {
        type: 'weight',
        value: 75.5,
        date: testDate,
        notes: 'e2e test — safe to delete',
      },
    });

    const data = parseToolResult<LogMeasurementResult>(result);

    expect(typeof data.id).toBe('number');
    expect(data.type).toBe('weight');
    expect(typeof data.label).toBe('string');
    expect(data.value).toBe(75.5);
    expect(typeof data.unit).toBe('string');
    expect(data.date).toBe(testDate);
    expect(data.previousMeasurement === null || typeof data.previousMeasurement === 'object').toBe(true);

    loggedId = data.id;
  });

  it('logs a second measurement and previous measurement is populated', async () => {
    expect(loggedId).toBeDefined();

    const result = await client.callTool({
      name: 'calories_log_measurement',
      arguments: {
        type: 'weight',
        value: 75.2,
        date: testDate2,
      },
    });

    const data = parseToolResult<LogMeasurementResult>(result);

    expect(data.value).toBe(75.2);
    expect(data.previousMeasurement).not.toBeNull();
    expect(data.previousMeasurement!.value).toBe(75.5);
    expect(data.previousMeasurement!.date).toBe(testDate);

    secondLoggedId = data.id;
  });

  it('retrieves logged measurements filtered by type', async () => {
    const result = await client.callTool({
      name: 'calories_get_measurements',
      arguments: { type: 'weight', dateFrom: testDate, dateTo: testDate2 },
    });

    const data = parseToolResult<GetMeasurementsResult>(result);

    expect(Array.isArray(data.entries)).toBe(true);
    expect(typeof data.count).toBe('number');
    expect(data.count).toBeGreaterThanOrEqual(2);

    const entry = data.entries.find(e => e.id === loggedId);
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('weight');
    expect(entry!.value).toBe(75.5);
    expect(entry!.date).toBe(testDate);
    expect(typeof entry!.label).toBe('string');
    expect(typeof entry!.unit).toBe('string');
  });

  it('get_measurements entry has all required fields', async () => {
    const result = await client.callTool({
      name: 'calories_get_measurements',
      arguments: { type: 'weight', dateFrom: testDate, dateTo: testDate },
    });

    const data = parseToolResult<GetMeasurementsResult>(result);
    expect(data.entries.length).toBeGreaterThan(0);

    const e = data.entries[0]!;
    expect(typeof e.id).toBe('number');
    expect(typeof e.type).toBe('string');
    expect(typeof e.label).toBe('string');
    expect(typeof e.value).toBe('number');
    expect(typeof e.unit).toBe('string');
    expect(typeof e.date).toBe('string');
    expect(e.notes === null || typeof e.notes === 'string').toBe(true);
  });

  it('deletes the first measurement and verifies it is gone', async () => {
    expect(loggedId).toBeDefined();

    const deleteResult = await client.callTool({
      name: 'calories_delete_measurement',
      arguments: { id: loggedId },
    });

    const data = parseToolResult<DeleteMeasurementResult>(deleteResult);
    expect(data.deleted).toBe(true);
    expect(data.id).toBe(loggedId);

    const listResult = await client.callTool({
      name: 'calories_get_measurements',
      arguments: { type: 'weight', dateFrom: testDate, dateTo: testDate },
    });
    const listData = parseToolResult<GetMeasurementsResult>(listResult);
    const stillPresent = listData.entries.some(e => e.id === loggedId);
    expect(stillPresent).toBe(false);

    loggedId = undefined;
  });

  it('returns an error when deleting a non-existent measurement', async () => {
    const result = await client.callTool({
      name: 'calories_delete_measurement',
      arguments: { id: 999999999 },
    });

    expect(result.isError).toBe(true);
  });
});
