import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

vi.mock('@my-hub/shared/services', () => ({
  putLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

import { putLog } from '@my-hub/shared/services';
import requestLoggerPlugin from './request-logger.js';

/** putLog runs from the onResponse hook without being awaited — give it a tick to fire. */
const flushLogs = () => new Promise(resolve => setTimeout(resolve, 20));

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(requestLoggerPlugin);
  app.get('/health', async () => ({ ok: true }));
  app.get('/quiet', { logLevel: 'silent' }, async () => ({ ok: true }));
  app.setNotFoundHandler(async (_req, reply) => reply.status(404).send());
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.mocked(putLog).mockClear();
});

describe('requestLoggerPlugin', () => {
  it('logs requests to known routes', async () => {
    await app.inject({ method: 'GET', url: '/health' });
    await flushLogs();

    expect(putLog).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'mcp-service', method: 'GET', path: '/health', statusCode: 200 }),
    );
  });

  it('does not log requests that match no route (scanner probes)', async () => {
    const res = await app.inject({ method: 'GET', url: '/.env' });
    await flushLogs();

    expect(res.statusCode).toBe(404);
    expect(putLog).not.toHaveBeenCalled();
  });

  it('does not log routes marked silent', async () => {
    await app.inject({ method: 'GET', url: '/quiet' });
    await flushLogs();

    expect(putLog).not.toHaveBeenCalled();
  });
});
