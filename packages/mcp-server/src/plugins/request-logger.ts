import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
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

/**
 * Attempt to decode the Bearer token payload (without signature verification)
 * to extract the user's email and user_id for log display.
 * Returns null if no token is present or decoding fails.
 */
function decodeTokenPayload(authHeader: string | undefined): { email?: string; userId?: string } | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  try {
    const base64 = token.slice(0, dot).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as {
      email?: string;
      user_id?: string;
    };
    return { email: payload.email, userId: payload.user_id };
  } catch {
    return null;
  }
}

/** Resolve the identifier shown in log brackets: email → userId (short) → IP. */
function resolveIdentifier(tokenInfo: { email?: string; userId?: string } | null, ip: string): string {
  if (tokenInfo?.email) return tokenInfo.email;
  if (tokenInfo?.userId) return tokenInfo.userId.slice(0, 8);
  return ip;
}

declare module 'fastify' {
  interface FastifyRequest {
    _logStartTime: number;
    _logIdentifier: string;
    _logUserId: string | undefined;
  }
}

async function requestLoggerPlugin(app: FastifyInstance) {
  app.decorateRequest('_logStartTime', 0);
  app.decorateRequest('_logIdentifier', '');
  app.decorateRequest('_logUserId', undefined);

  app.addHook('onRequest', async (req) => {
    if (req.routeOptions.logLevel === 'silent') return;

    req._logStartTime = Date.now();
    const tokenInfo = decodeTokenPayload(req.headers['authorization']);
    req._logIdentifier = resolveIdentifier(tokenInfo, req.ip);
    req._logUserId = tokenInfo?.userId;

    console.log(`<-- ${req.method} ${req.url} [${req._logIdentifier}]`);
  });

  app.addHook('onResponse', async (req, reply) => {
    if (req.routeOptions.logLevel === 'silent') return;

    const durationMs = Date.now() - req._logStartTime;
    const bodySize = Number(reply.getHeader('content-length') ?? 0);
    const status = reply.statusCode;

    console.log(`--> ${req.method} ${req.url} ${status} ${durationMs}ms ${bodySize}b [${req._logIdentifier}]`);

    // Write to DB asynchronously — don't await so we don't slow down the response.
    const logData: Parameters<typeof putLog>[0] = {
      service: 'mcp-service',
      method: req.method,
      path: req.url,
      statusCode: status,
      durationMs,
      ip: req.ip || null,
      userId: req._logUserId ?? null,
    };

    if (envConfig.LOG_PAYLOADS) {
      logData.requestBody = capPayload({
        body: req.body,
        query: req.query,
        headers: req.headers,
      });
    }

    putLog(logData).catch((err) => {
      app.log.error({ err }, 'Failed to write request log to DB');
    });
  });
}

export default fp(requestLoggerPlugin, { name: 'request-logger' });
