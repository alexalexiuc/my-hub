import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { McpServer, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { McpServerNames } from '@my-hub/shared/constants';

vi.mock('@my-hub/shared/services', () => ({
  putLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

vi.mock('../plugins/oauth-verifier.js', () => ({
  createHubTokenVerifier: (serverName: string) => ({
    async verifyAccessToken(token: string) {
      if (token !== 'good-token') throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired token');
      return {
        token,
        clientId: 'client-1',
        scopes: ['mcp:read', 'mcp:write'],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        extra: { userId: 'user-1', clientId: 'client-1', serverName, timezone: 'UTC' },
      };
    },
  }),
}));

import { putLog } from '@my-hub/shared/services';
import { defineTool, registerTools, toolResponse } from '../shared/toolsUtils.js';
import { HandledError } from '../shared/errors.js';
import { registerMcpSubServer } from './sub-server.js';
import { mcpSubServers } from './registry.js';

const ENDPOINT = '/api/calories/mcp';

const tools = [
  defineTool({
    name: 'echo',
    inputSchema: { text: z.string() },
    callback: async ({ text }, context) => toolResponse({ text, userId: context.userId }),
  }),
  defineTool({
    name: 'fail',
    callback: async () => {
      throw new HandledError('Nope');
    },
  }),
];

const factory = vi.fn(() => {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  registerTools(server, tools);
  return server;
});

let app: FastifyInstance;
let baseUrl: string;

async function connect(token = 'good-token'): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT, baseUrl), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(transport);
  return client;
}

/** putLog runs from the response `close` listener — give it a tick to fire. */
const flushLogs = () => new Promise(resolve => setTimeout(resolve, 20));

beforeAll(async () => {
  mcpSubServers.length = 0;
  app = Fastify();
  registerMcpSubServer(app, ENDPOINT, McpServerNames.Calories, factory);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const { port } = app.server.address() as { port: number };
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await app.close();
  mcpSubServers.length = 0;
});

beforeEach(() => {
  vi.mocked(putLog).mockClear();
  factory.mockClear();
});

describe('registerMcpSubServer (MCP 2026-07-28, stateless)', () => {
  it('lists and calls tools with the verified Hub identity, without any session', async () => {
    const client = await connect();

    const { tools: listed } = await client.listTools();
    expect(listed.map(t => t.name)).toEqual(['echo', 'fail']);
    expect(listed[0]?.inputSchema).toMatchObject({ type: 'object', properties: { text: { type: 'string' } } });

    const result = await client.callTool({ name: 'echo', arguments: { text: 'hi' } });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ text: 'hi', userId: 'user-1' }) }]);

    // One fresh McpServer per HTTP request.
    expect(factory.mock.calls.length).toBeGreaterThanOrEqual(2);
    await client.close();
  });

  it('reports handler errors as tool errors', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'fail', arguments: {} });
    expect(result.isError).toBe(true);
    await client.close();
  });

  it('answers a bad token with 401 and a WWW-Authenticate challenge', async () => {
    const res = await fetch(new URL(ENDPOINT, baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bad-token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('rejects requests whose Host is not allowlisted', async () => {
    const { port } = app.server.address() as { port: number };
    const res = await app.inject({
      method: 'POST',
      url: ENDPOINT,
      headers: { host: `evil.example:${port}`, 'content-type': 'application/json', authorization: 'Bearer good-token' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('exposes request stats for the monitor route', () => {
    const entry = mcpSubServers.find(s => s.endpoint === ENDPOINT);
    expect(entry?.serverName).toBe(McpServerNames.Calories);
    expect(entry?.getStats().requestsTotal).toBeGreaterThan(0);
  });
});

describe('attachMcpRequestLogger', () => {
  it('logs a successful tool call with tool path, identity, status and duration', async () => {
    const client = await connect();
    await client.callTool({ name: 'echo', arguments: { text: 'hi' } });
    await client.close();
    await flushLogs();

    expect(putLog).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'mcp-service',
        method: 'tools/call',
        path: `${ENDPOINT}#echo`,
        server: McpServerNames.Calories,
        userId: 'user-1',
        clientId: 'client-1',
        statusCode: 200,
        error: null,
        durationMs: expect.any(Number),
      }),
    );
  });

  it('logs a failed tool call as 422 with the error text', async () => {
    const client = await connect();
    await client.callTool({ name: 'fail', arguments: {} });
    await client.close();
    await flushLogs();

    expect(putLog).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'tools/call', path: `${ENDPOINT}#fail`, statusCode: 422, error: 'Nope' }),
    );
  });

  it('logs rejected requests with their HTTP status and no identity', async () => {
    await fetch(new URL(ENDPOINT, baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bad-token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    await flushLogs();

    expect(putLog).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'tools/list', path: ENDPOINT, statusCode: 401, userId: null }),
    );
  });
});
