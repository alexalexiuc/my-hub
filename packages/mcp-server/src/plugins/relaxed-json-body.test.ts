import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import relaxedJsonBodyPlugin from './relaxed-json-body.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(relaxedJsonBodyPlugin);

  app.delete('/mcp', async req => {
    return { body: req.body ?? null };
  });

  app.post('/mcp', async req => {
    return { body: req.body ?? null };
  });

  return app;
}

describe('relaxedJsonBodyPlugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('treats an empty application/json body as null', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ body: null });
  });

  it('preserves normal JSON parsing for non-empty bodies', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ok: true }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ body: { ok: true } });
  });
});
