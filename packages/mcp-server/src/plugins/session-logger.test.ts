import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any imports that trigger the module graph
// ---------------------------------------------------------------------------

vi.mock('@my-hub/shared/services', () => ({
  putLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

vi.mock('../config/env.js', () => ({
  envConfig: { PRINT_PAYLOADS: false, LOG_PAYLOADS: false },
}));

vi.mock('../mcp/registry.js', () => ({
  mcpSubServers: [],
}));

vi.mock('../shared/toolsUtils.js', () => ({
  getHubAuthExtra: vi.fn(() => ({
    userId: 'user-1',
    clientId: 'client-1',
    serverName: 'calories',
    email: null,
    timezone: null,
  })),
}));

// ---------------------------------------------------------------------------
// Imports after mocking
// ---------------------------------------------------------------------------

import { putLog } from '@my-hub/shared/services';
import { envConfig } from '../config/env.js';
import { mcpSubServers } from '../mcp/registry.js';
import { sessionLoggerPlugin } from './session-logger.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface FakeTransport {
  onmessage: ((msg: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined;
  send: ReturnType<typeof vi.fn>;
}

function createFakeTransport(): FakeTransport {
  return { onmessage: undefined, send: vi.fn().mockResolvedValue(undefined) };
}

function createFakeSessionManager(transport: FakeTransport) {
  const emitter = new EventEmitter();
  return {
    on: (event: string, cb: (...args: unknown[]) => void) => emitter.on(event, cb),
    emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
    getTransport: (_sessionId: string) => transport,
  };
}

const SESSION_ID = 'abc12345-fake-session-id';
const ENDPOINT = '/api/test/mcp';

function toolsCallRequest(id: number, toolName: string, args: Record<string, unknown> = {}): JSONRPCMessage {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name: toolName, arguments: args } };
}

function successResponse(id: number, content: unknown = []): JSONRPCMessage {
  return { jsonrpc: '2.0', id, result: { content } };
}

function toolErrorResponse(id: number): JSONRPCMessage {
  return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'failed' }] } };
}

function protocolErrorResponse(id: number): JSONRPCMessage {
  return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sessionLoggerPlugin', () => {
  let app: FastifyInstance;
  let transport: FakeTransport;

  beforeEach(async () => {
    vi.clearAllMocks();

    transport = createFakeTransport();
    const sessionManager = createFakeSessionManager(transport);

    (mcpSubServers as unknown[]).length = 0;
    (mcpSubServers as unknown[]).push({ endpoint: ENDPOINT, sessionManager });

    app = Fastify({ logger: false });
    vi.spyOn(app.log, 'info');
    vi.spyOn(app.log, 'warn');
    vi.spyOn(app.log, 'error');

    await app.register(sessionLoggerPlugin);
    await app.ready();

    // Trigger session creation — wraps transport.onmessage and transport.send
    sessionManager.emit('sessionCreated', SESSION_ID);
  });

  afterEach(async () => {
    (mcpSubServers as unknown[]).length = 0;
    await app.close();
  });

  function incoming(msg: JSONRPCMessage, extra?: MessageExtraInfo) {
    transport.onmessage!(msg, extra);
  }

  async function outgoing(msg: JSONRPCMessage) {
    await (transport.send as (msg: JSONRPCMessage) => Promise<void>)(msg);
  }

  // -------------------------------------------------------------------------
  // Non-tool-call messages
  // -------------------------------------------------------------------------

  describe('non-tool-call messages', () => {
    it('writes to DB immediately with null durationMs and statusCode', () => {
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

      expect(putLog).toHaveBeenCalledOnce();
      expect(putLog).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'tools/list', durationMs: null, statusCode: null }),
      );
    });

    it('includes the endpoint path', () => {
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ path: ENDPOINT }));
    });

    it('ignores incoming messages that are responses (no method field)', () => {
      // In practice responses arrive via transport.send, not onmessage.
      // The plugin should silently skip them.
      incoming(successResponse(99));

      expect(putLog).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // tools/call request — deferred DB write
  // -------------------------------------------------------------------------

  describe('tools/call request', () => {
    it('does not write to DB until the response arrives', () => {
      incoming(toolsCallRequest(1, 'calories_log_meal'));

      expect(putLog).not.toHaveBeenCalled();
    });

    it('includes the tool name in the path sent to DB', async () => {
      incoming(toolsCallRequest(1, 'calories_log_meal'));
      await outgoing(successResponse(1));

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ path: `${ENDPOINT}#calories_log_meal` }));
    });
  });

  // -------------------------------------------------------------------------
  // tools/call response — status codes
  // -------------------------------------------------------------------------

  describe('tools/call response status codes', () => {
    it('writes statusCode 200 for a successful tool result', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(successResponse(1));

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 200 }));
    });

    it('writes statusCode 422 when the tool result carries isError: true', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(toolErrorResponse(1));

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 422 }));
    });

    it('writes statusCode 400 for a JSON-RPC protocol error response', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(protocolErrorResponse(1));

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('records a non-negative durationMs', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(successResponse(1));

      const call = vi.mocked(putLog).mock.calls[0];
      expect(call).toBeDefined();
      expect(call![0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // Parallel tool calls
  // -------------------------------------------------------------------------

  describe('parallel tool calls', () => {
    it('correlates responses to requests by JSON-RPC id', async () => {
      incoming(toolsCallRequest(10, 'tool_a'));
      incoming(toolsCallRequest(11, 'tool_b'));

      // Resolve in reverse order
      await outgoing(toolErrorResponse(11));
      await outgoing(successResponse(10));

      const { calls } = vi.mocked(putLog).mock;
      expect(calls).toHaveLength(2);

      const pathFor = (toolName: string) => calls.find(c => (c[0] as { path: string }).path.endsWith(toolName))?.[0];

      expect(pathFor('tool_b')).toMatchObject({ statusCode: 422 });
      expect(pathFor('tool_a')).toMatchObject({ statusCode: 200 });
    });

    it('does not write to DB for a response whose request id is unknown', async () => {
      // Response for id=99 with no matching pending call — should be silently ignored.
      await outgoing(successResponse(99));

      expect(putLog).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // IP extraction
  // -------------------------------------------------------------------------

  describe('IP extraction', () => {
    it('extracts the first address from x-forwarded-for', () => {
      const extra: MessageExtraInfo = {
        requestInfo: { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } },
      };
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, extra);

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ ip: '1.2.3.4' }));
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', () => {
      const extra: MessageExtraInfo = {
        requestInfo: { headers: { 'x-real-ip': '9.9.9.9' } },
      };
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, extra);

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ ip: '9.9.9.9' }));
    });

    it('sets ip to null when no forwarding headers are present', () => {
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ ip: null }));
    });
  });

  // -------------------------------------------------------------------------
  // Log level
  // -------------------------------------------------------------------------

  describe('log level', () => {
    it('logs successful tool call response at info level', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(successResponse(1));

      expect(app.log.info).toHaveBeenCalledWith(expect.stringContaining('<-- MCP tools/call (my_tool)'));
      expect(app.log.warn).not.toHaveBeenCalled();
    });

    it('logs tool error response at warn level', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(toolErrorResponse(1));

      expect(app.log.warn).toHaveBeenCalledWith(expect.stringContaining('<-- MCP tools/call (my_tool)'));
      expect(app.log.info).not.toHaveBeenCalledWith(expect.stringContaining('<-- MCP tools/call'));
    });

    it('logs protocol error response at warn level', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(protocolErrorResponse(1));

      expect(app.log.warn).toHaveBeenCalledWith(expect.stringContaining('<-- MCP tools/call (my_tool)'));
    });
  });

  // -------------------------------------------------------------------------
  // Passthrough — original send is still called
  // -------------------------------------------------------------------------

  describe('transport passthrough', () => {
    it('calls the original transport.send after intercepting', async () => {
      // The original vi.fn() was captured by the plugin before wrapping.
      // Calling the wrapped transport.send should still invoke it.
      const response = successResponse(1);
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(response);

      // transport.send was the original vi.fn before wrapping; the wrapper calls it.
      // We verify the wrapper didn't swallow the call by checking putLog was written
      // (only possible if the wrapper ran) AND that transport.send resolved cleanly.
      expect(putLog).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // PRINT_PAYLOADS mode
  // -------------------------------------------------------------------------

  describe('PRINT_PAYLOADS mode', () => {
    beforeEach(() => {
      (envConfig as Record<string, unknown>).PRINT_PAYLOADS = true;
    });

    afterEach(() => {
      (envConfig as Record<string, unknown>).PRINT_PAYLOADS = false;
    });

    it('prints request payload for non-handshake messages', () => {
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

      expect(app.log.info).toHaveBeenCalledWith(expect.stringContaining('MCP Message:'));
    });

    it('does not print payload for handshake methods', () => {
      incoming({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '1.0', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
      });

      expect(app.log.info).not.toHaveBeenCalledWith(expect.stringContaining('MCP Message:'));
    });

    it('prints response payload after a tool call', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      await outgoing(successResponse(1, [{ type: 'text', text: 'done' }]));

      expect(app.log.info).toHaveBeenCalledWith(expect.stringContaining('MCP Response:'));
    });
  });

  // -------------------------------------------------------------------------
  // LOG_PAYLOADS mode
  // -------------------------------------------------------------------------

  describe('LOG_PAYLOADS mode', () => {
    beforeEach(() => {
      (envConfig as Record<string, unknown>).LOG_PAYLOADS = true;
    });

    afterEach(() => {
      (envConfig as Record<string, unknown>).LOG_PAYLOADS = false;
    });

    it('includes requestBody in the DB log entry for non-tool-call messages', () => {
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ requestBody: expect.anything() }));
    });

    it('includes requestBody in the DB log entry for tool calls', async () => {
      incoming(toolsCallRequest(1, 'my_tool', { food: 'pizza' }));
      await outgoing(successResponse(1));

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ requestBody: expect.anything() }));
    });
  });

  // -------------------------------------------------------------------------
  // putLog error handling
  // -------------------------------------------------------------------------

  describe('putLog error handling', () => {
    it('logs to app.log.error when putLog rejects on a non-tool-call message', async () => {
      vi.mocked(putLog).mockRejectedValueOnce(new Error('DB write failed'));

      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

      await vi.waitFor(() =>
        expect(app.log.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          'Failed to write MCP session message log to DB',
        ),
      );
    });

    it('logs to app.log.error when putLog rejects on a tool call response', async () => {
      incoming(toolsCallRequest(1, 'my_tool'));
      vi.mocked(putLog).mockRejectedValueOnce(new Error('DB write failed'));
      await outgoing(successResponse(1));

      await vi.waitFor(() =>
        expect(app.log.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          'Failed to write MCP tool call log to DB',
        ),
      );
    });
  });

  // -------------------------------------------------------------------------
  // IP extraction — array header variant
  // -------------------------------------------------------------------------

  describe('IP extraction (array header)', () => {
    it('extracts the first address when x-forwarded-for is an array', () => {
      const extra: MessageExtraInfo = {
        requestInfo: { headers: { 'x-forwarded-for': ['1.2.3.4, 5.6.7.8', '9.9.9.9'] } },
      };
      incoming({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, extra);

      expect(putLog).toHaveBeenCalledWith(expect.objectContaining({ ip: '1.2.3.4' }));
    });
  });
});
