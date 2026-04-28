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

  it('returns 500 when response payload does not match response schema', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', email: 'test@example.com' });

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
