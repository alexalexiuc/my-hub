import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, type McpClient } from './helpers/mcp-client.js';

interface ApiarySummaryResource {
  yardCount: number;
  hiveCount: number;
  pendingTaskCount: number;
  recentLogs: unknown[];
  upcomingTasks: unknown[];
}

interface ApiaryHivesResource {
  hives: unknown[];
  count: number;
}

interface ApiaryTasksResource {
  tasks: unknown[];
  count: number;
}

/**
 * E2e tests for the apiary MCP resources.
 *
 * These are structure-only tests: they verify that each apiary:// resource
 * returns the expected shape without requiring any pre-existing apiary data.
 */
describe.sequential('apiary — resources', () => {
  let client: McpClient;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/apiary/mcp', token);
  });

  afterAll(async () => {
    await client.close();
  });

  it('apiary://summary returns a valid structure', async () => {
    const result = await client.readResource({ uri: 'apiary://summary' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as ApiarySummaryResource;

    expect(typeof data.yardCount).toBe('number');
    expect(typeof data.hiveCount).toBe('number');
    expect(typeof data.pendingTaskCount).toBe('number');
    expect(Array.isArray(data.recentLogs)).toBe(true);
    expect(Array.isArray(data.upcomingTasks)).toBe(true);
  });

  it('apiary://hives returns a valid structure', async () => {
    const result = await client.readResource({ uri: 'apiary://hives' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as ApiaryHivesResource;

    expect(Array.isArray(data.hives)).toBe(true);
    expect(typeof data.count).toBe('number');
    expect(data.count).toBe(data.hives.length);
  });

  it('apiary://tasks returns a valid structure', async () => {
    const result = await client.readResource({ uri: 'apiary://tasks' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as ApiaryTasksResource;

    expect(Array.isArray(data.tasks)).toBe(true);
    expect(typeof data.count).toBe('number');
    expect(data.count).toBe(data.tasks.length);
  });
});
