import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { route } from './route';

const { mockGetAuthUser, mockWriteApiLog } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockWriteApiLog: vi.fn(async () => undefined),
}));

vi.mock('@/lib/auth-user', () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock('@/config/env', () => ({
  hubEnvConfig: { PRINT_PAYLOADS: false },
}));

vi.mock('./with-error-logging', async () => {
  const actual = await vi.importActual<typeof import('./with-error-logging')>('./with-error-logging');
  return {
    ...actual,
    writeApiLog: mockWriteApiLog,
  };
});

describe('route()', () => {
  beforeEach(() => {
    mockGetAuthUser.mockReset();
    mockWriteApiLog.mockClear();
  });

  it('returns 401 for protected routes when unauthenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const handler = route(async () => ({ ok: true }));
    const response = await handler(new Request('https://hub.local/api/protected'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('allows unauthenticated public routes and passes null user', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const handler = route({ public: true })(async ({ user }) => ({ ok: true, isAnonymous: user === null }));
    const response = await handler(new Request('https://hub.local/api/public'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, isAnonymous: true });
  });

  describe('empty request bodies', () => {
    const PatchSchema = z.object({ name: z.string().optional(), notes: z.string().nullish() });

    const send = (method: string, body: unknown, schema: z.ZodType = PatchSchema) => {
      const handler = route({ body: schema })(async ({ body: parsed }) => ({ received: parsed }));
      return handler(
        new Request('https://hub.local/api/thing', {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
    };

    beforeEach(() => {
      mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', email: 'test@example.com' });
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s with a body that has no fields', async method => {
      const response = await send(method, {});

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Request body must not be empty' });
    });

    it('rejects a body whose every field was stripped by the schema', async () => {
      const response = await send('PATCH', { unknownField: 1 });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Request body must not be empty' });
    });

    it('accepts a body carrying an explicit null', async () => {
      const response = await send('PATCH', { notes: null });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: { notes: null } });
    });

    it('accepts an empty body on a route that opts out with allowEmptyBody', async () => {
      const handler = route({ body: PatchSchema, allowEmptyBody: true })(async ({ body }) => ({ received: body }));
      const response = await handler(
        new Request('https://hub.local/api/thing', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: {} });
    });

    it('accepts an empty body that the schema fills with defaults', async () => {
      const response = await send('POST', {}, z.object({ limit: z.number().default(10) }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: { limit: 10 } });
    });

    it('accepts a non-object body such as an array', async () => {
      const response = await send('POST', [], z.array(z.string()));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: [] });
    });
  });

  it('returns 500 when response payload does not match response schema', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', email: 'test@example.com' });

    // @ts-expect-error intentionally returning wrong type to verify runtime 500 response
    const handler = route({ response: z.object({ ok: z.literal(true) }) })(async () => ({ ok: false }));
    const response = await handler(new Request('https://hub.local/api/strict'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal Server Error' });
  });

  it('returns 200 when response payload matches response schema', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', email: 'test@example.com' });

    const handler = route({ response: z.object({ ok: z.literal(true) }) })(async () => ({ ok: true }));
    const response = await handler(new Request('https://hub.local/api/strict'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
