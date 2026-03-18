import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { putLog } from '@my-hub/shared/services';
import { envConfig } from '../config/env.js';

const MAX_PAYLOAD_BYTES = 10_240; // 10 KB cap per payload field

/** Truncate a JSON-serialisable value to MAX_PAYLOAD_BYTES (serialised). */
function capPayload(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  const serialised = JSON.stringify(value);
  if (serialised.length <= MAX_PAYLOAD_BYTES) return value;
  return { _truncated: true, preview: serialised.slice(0, MAX_PAYLOAD_BYTES) };
}

async function requestLoggerPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    if (req.routeOptions.logLevel === 'silent') return;

    console.log(`<-- ${req.method} ${req.url}`);
    if (envConfig.PRINT_PAYLOADS) {
      console.log(
        `    Payload: ${JSON.stringify(capPayload({ body: req.body, query: req.query, headers: req.headers }), null, 2)}`,
      );
    }
  });

  app.addHook('onResponse', async (req, reply) => {
    if (req.routeOptions.logLevel === 'silent') return;

    const durationMs = Math.round(reply.elapsedTime);
    const bodySize = Number(reply.getHeader('content-length') ?? 0);
    const status = reply.statusCode;

    console.log(`--> ${req.method} ${req.url} ${status} ${durationMs}ms ${bodySize}b`);

    // Read userId from verified auth (set by fastify-mcp-server's bearer middleware).
    // Falls back to null for unauthenticated or non-MCP routes — never uses unverified token data.
    const auth = (req.raw as { auth?: AuthInfo }).auth;
    const verifiedUserId = (auth?.extra?.['userId'] as string | undefined) ?? null;

    // Write to DB asynchronously — don't await so we don't slow down the response.
    const logData: Parameters<typeof putLog>[0] = {
      service: 'mcp-service',
      method: req.method,
      path: req.url,
      statusCode: status,
      durationMs,
      ip: req.ip || null,
      userId: verifiedUserId,
    };

    if (envConfig.LOG_PAYLOADS) {
      logData.requestBody = capPayload({
        body: req.body,
        query: req.query,
        headers: req.headers,
      });
    }

    if (envConfig.PRINT_PAYLOADS) {
      console.log(
        `    Payload: ${JSON.stringify(capPayload({ body: req.body, query: req.query, headers: req.headers }), null, 2)}`,
      );
    }

    putLog(logData).catch((err) => {
      app.log.error({ err }, 'Failed to write request log to DB');
    });
  });
}

export default fp(requestLoggerPlugin, { name: 'request-logger' });
