import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { putLog } from '@my-hub/shared/services';
import { McpServerName } from '@my-hub/shared/schema';
import { envConfig } from '../config/env.js';

const MAX_PAYLOAD_BYTES = 10_240; // 10 KB cap per payload field
const REDACTED = '[REDACTED]';
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
]);

function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers)) {
    redacted[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? REDACTED : value;
  }
  return redacted;
}

function buildRequestPayload(req: FastifyRequest) {
  return {
    body: req.body,
    query: req.query,
    headers: redactHeaders(req.headers as Record<string, unknown>),
  };
}

/** Truncate a JSON-serialisable value to MAX_PAYLOAD_BYTES (serialised). */
function capPayload(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  const serialised = JSON.stringify(value);
  if (serialised.length <= MAX_PAYLOAD_BYTES) return value;
  return { _truncated: true, preview: serialised.slice(0, MAX_PAYLOAD_BYTES) };
}

// Extend FastifyRequest to carry the captured response body between hooks.
declare module 'fastify' {
  interface FastifyRequest {
    _capturedResponseBody?: unknown;
  }
}

async function requestLoggerPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    // logLevel:'silent' set on known routes; empty url means no route matched (setNotFoundHandler)
    if (req.routeOptions.logLevel === 'silent' || req.routeOptions.url === '') return;

    console.log(`<-- ${req.method} ${req.url}`);
    if (envConfig.PRINT_PAYLOADS) {
      console.log(`\tRequest: ${JSON.stringify(capPayload(buildRequestPayload(req)), null, 2)}`);
    }
  });

  // onSend is the only hook where the serialised response payload is available.
  // Capture it onto the request for use in onResponse (where it is no longer accessible).
  // Return undefined so Fastify keeps the original payload untouched.
  app.addHook('onSend', async (req: FastifyRequest, _reply, payload) => {
    if (req.routeOptions.logLevel === 'silent' || req.routeOptions.url === '') return;

    if (envConfig.LOG_PAYLOADS || envConfig.PRINT_PAYLOADS) {
      try {
        const raw = typeof payload === 'string' ? payload : Buffer.isBuffer(payload) ? payload.toString('utf8') : null;
        if (raw) req._capturedResponseBody = JSON.parse(raw);
      } catch {
        // binary or non-JSON response — skip capture
      }
    }
  });

  app.addHook('onResponse', async (req, reply) => {
    if (req.routeOptions.logLevel === 'silent' || req.routeOptions.url === '') return;

    const durationMs = Math.round(reply.elapsedTime);
    const bodySize = Number(reply.getHeader('content-length') ?? 0);
    const status = reply.statusCode;

    console.log(`--> ${req.method} ${req.url} ${status} ${durationMs}ms ${bodySize}b`);

    // Read userId from verified auth (set by fastify-mcp-server's bearer middleware).
    // Falls back to null for unauthenticated or non-MCP routes — never uses unverified token data.
    const auth = (req.raw as { auth?: AuthInfo }).auth;
    const verifiedUserId = (auth?.extra?.['userId'] as string | undefined) ?? null;
    const verifiedClientId = (auth?.extra?.['clientId'] as string | undefined) ?? null;
    const verifiedServerName = (auth?.extra?.['serverName'] as McpServerName | undefined) ?? null;

    // Write to DB asynchronously — don't await so we don't slow down the response.
    const logData: Parameters<typeof putLog>[0] = {
      service: 'mcp-service',
      server: verifiedServerName,
      method: req.method,
      path: req.url,
      statusCode: status,
      durationMs,
      ip: req.ip || null,
      userId: verifiedUserId,
      clientId: verifiedClientId,
    };

    if (envConfig.LOG_PAYLOADS) {
      logData.requestBody = capPayload(buildRequestPayload(req));
      logData.responseBody = capPayload(req._capturedResponseBody);
    }

    if (envConfig.PRINT_PAYLOADS) {
      console.log(`\tResponse: ${JSON.stringify(capPayload(req._capturedResponseBody), null, 2)}`);
    }

    putLog(logData).catch((err) => {
      app.log.error({ err }, 'Failed to write request log to DB');
    });
  });
}

export default fp(requestLoggerPlugin, { name: 'request-logger' });
