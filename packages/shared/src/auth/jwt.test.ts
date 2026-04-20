import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { signToken, verifyToken, verifyPkceS256 } from './jwt';

const SECRET = 'test-secret-32-chars-long-enough!';

describe('signToken', () => {
  it('returns a JWT string', async () => {
    const token = await signToken({ sub: 'user-1' }, SECRET);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('encodes the payload claims', async () => {
    const token = await signToken({ sub: 'user-1', email: 'a@b.com' }, SECRET);
    const payload = await verifyToken<{ sub: string; email: string }>(token, SECRET);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.email).toBe('a@b.com');
  });

  it('sets exp in the future using expiresInMinutes', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signToken({ sub: 'user-1' }, SECRET, 10);
    const payload = await verifyToken<{ sub: string }>(token, SECRET);
    expect(payload?.exp).toBeGreaterThanOrEqual(before + 10 * 60);
    expect(payload?.exp).toBeLessThanOrEqual(before + 10 * 60 + 5);
  });

  it('defaults to 5 minute expiry', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signToken({ sub: 'user-1' }, SECRET);
    const payload = await verifyToken<{ sub: string }>(token, SECRET);
    expect(payload?.exp).toBeGreaterThanOrEqual(before + 5 * 60);
    expect(payload?.exp).toBeLessThanOrEqual(before + 5 * 60 + 5);
  });
});

describe('verifyToken', () => {
  it('returns the payload for a valid token', async () => {
    const token = await signToken({ sub: 'user-1' }, SECRET);
    const payload = await verifyToken<{ sub: string }>(token, SECRET);
    expect(payload?.sub).toBe('user-1');
  });

  it('returns null for a token signed with a different secret', async () => {
    const token = await signToken({ sub: 'user-1' }, SECRET);
    const payload = await verifyToken(token, 'wrong-secret');
    expect(payload).toBeNull();
  });

  it('returns null for a malformed token', async () => {
    const payload = await verifyToken('not.a.token', SECRET);
    expect(payload).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const token = await signToken({ sub: 'user-1' }, SECRET, -1);
    const payload = await verifyToken(token, SECRET);
    expect(payload).toBeNull();
  });

  it('includes exp in the returned payload', async () => {
    const token = await signToken({ sub: 'user-1' }, SECRET, 5);
    const payload = await verifyToken<{ sub: string }>(token, SECRET);
    expect(typeof payload?.exp).toBe('number');
  });
});

describe('verifyPkceS256', () => {
  it('returns true for a matching verifier and challenge', () => {
    // echo -n "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" | openssl dgst -binary -sha256 | openssl base64 -A | tr '+/' '-_' | tr -d '='
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it('returns false for a wrong verifier', () => {
    const verifier = 'correct-verifier';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkceS256('wrong-verifier', challenge)).toBe(false);
  });
});
