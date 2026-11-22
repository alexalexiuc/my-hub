import Fastify, { type FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_DELETE_ALL_PATH, NOTES_DELETE_ALL_PURPOSE } from '@my-hub/shared/constants';
import { notesInternalRoutes } from './routes';
import { deleteNotesOf, notesConfigured } from './runtime';

const SECRET = 'test-secret-test-secret-test-secret';

vi.mock('../config/env.js', () => ({ envConfig: { NEXTAUTH_SECRET: 'test-secret-test-secret-test-secret' } }));
vi.mock('./runtime.js', () => ({ deleteNotesOf: vi.fn(), notesConfigured: vi.fn() }));

const sign = (payload: Record<string, unknown>, secret = SECRET) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));

describe('notes delete-all route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.mocked(notesConfigured).mockReturnValue(true);
    vi.mocked(deleteNotesOf).mockResolvedValue(undefined);
    app = Fastify();
    await app.register(notesInternalRoutes);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  const post = (token?: string) =>
    app.inject({
      method: 'POST',
      url: NOTES_DELETE_ALL_PATH,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  it('rejects a request without a token', async () => {
    expect((await post()).statusCode).toBe(401);
    expect(deleteNotesOf).not.toHaveBeenCalled();
  });

  it('rejects a valid token without the delete-all purpose', async () => {
    expect((await post(await sign({ userId: 'u1' }))).statusCode).toBe(401);
    expect(deleteNotesOf).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await sign({ userId: 'u1', purpose: NOTES_DELETE_ALL_PURPOSE }, 'another-secret-another-secret-123');
    expect((await post(token)).statusCode).toBe(401);
    expect(deleteNotesOf).not.toHaveBeenCalled();
  });

  it("deletes the token's user's notes", async () => {
    const res = await post(await sign({ userId: 'u1', purpose: NOTES_DELETE_ALL_PURPOSE }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });
    expect(deleteNotesOf).toHaveBeenCalledWith('u1');
  });
});
