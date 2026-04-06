import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, type McpClient } from './helpers/mcp-client.js';
import { getLogs } from '@my-hub/shared/services';

/**
 * E2e tests for session-level MCP message logging.
 *
 * The HTTP request logger captures the session-open POST, but all subsequent
 * tool calls flow over the established SSE session without new HTTP requests.
 * sessionLoggerPlugin intercepts transport.onmessage to log these messages.
 *
 * These tests verify that tool calls made within an MCP session are written to
 * the api_request_logs table, and that other JSON-RPC methods are captured too.
 */
// Skip for now since test run in github CI where we do not have access to DB to query it.
describe.sequential.skip('session logger — MCP messages written to DB', () => {
  let client: McpClient | undefined;
  let userId: string;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    // Connect is done here; initialize request fires before our wrapper is set,
    // so it will not appear in session-logger DB rows.
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
    userId = process.env['E2E_MCP_USER_ID']!; // this is also unavailable in github CI
    if (!userId) throw new Error('E2E_MCP_USER_ID missing — run pnpm e2e:setup first');
  });

  afterAll(async () => {
    await client?.close();
  });

  it('writes a DB log entry for a tools/call within an established session', async () => {
    if (!client) throw new Error('MCP client was not initialized');

    const callStart = new Date();

    // Use a far-future date to avoid touching real data.
    await client.callTool({
      name: 'calories_get_meals',
      arguments: { date: '2099-12-31' },
    });

    // putLog is fire-and-forget in the plugin — allow it time to persist.
    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    const logs = await getLogs({ service: 'mcp-service', userId, from: callStart, limit: 50 });

    const entry = logs.find((l) => l.method === 'tools/call' && l.path.includes('#calories_get_meals'));

    expect(entry).toBeDefined();
    expect(entry!.server).toBe('calories');
    expect(entry!.userId).toBe(userId);
    expect(entry!.path).toBe('/api/calories/mcp#calories_get_meals');

    const logPayloadsEnabled = process.env['LOG_PAYLOADS'] === 'true';
    if (logPayloadsEnabled) {
      expect(entry!.requestBody).toBeTruthy();
      const payload = entry!.requestBody as Record<string, unknown>;
      expect(payload['method']).toBe('tools/call');
    } else {
      expect(entry!.requestBody).toBeNull();
    }
  });

  it('writes a DB log entry for non-tool-call MCP requests (tools/list)', async () => {
    if (!client) throw new Error('MCP client was not initialized');

    const callStart = new Date();

    await client.listTools();

    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    const logs = await getLogs({ service: 'mcp-service', userId, from: callStart, limit: 50 });

    const entry = logs.find((l) => l.method === 'tools/list');

    expect(entry).toBeDefined();
    expect(entry!.server).toBe('calories');
    expect(entry!.path).toBe('/api/calories/mcp');
  });
});
