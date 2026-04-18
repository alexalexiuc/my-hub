import { verifyToken, McpTokenPayload } from '@my-hub/shared/auth';
import { findOAuthClient } from '@my-hub/shared/services';
import { PromiseCacheX } from 'promise-cachex';
import { createHash } from 'node:crypto';

const AUTH_CACHE_TTL = 60_000 * 60 * 1; // 60 minutes

const authCache = new PromiseCacheX<McpTokenPayload>({
  ttl: AUTH_CACHE_TTL,
});

function toTokenCacheKey(token: string): string {
  const digest = createHash('sha256').update(token).digest('base64url');
  return `token:${digest}`;
}

export const cachedVerifyToken = async (token: string) => {
  const key = toTokenCacheKey(token);
  const payload = await authCache.get(key, async () => {
    // Step 1: Decode payload (no signature check yet) to extract client_id
    let clientId: string;
    let rawPayload: Partial<McpTokenPayload>;
    try {
      const dot = token.indexOf('.');
      if (dot === -1) throw new Error('Malformed token: missing dot separator');
      const payloadB64 = token.slice(0, dot);
      const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      rawPayload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Partial<McpTokenPayload>;
      if (!rawPayload.client_id) throw new Error('Missing client_id in token payload');
      clientId = rawPayload.client_id;
    } catch (err) {
      throw new Error(`Invalid token format: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 2: Look up OAuth client for tokenSigningSecret
    const client = await findOAuthClient(clientId);
    if (!client) {
      throw new Error('Unknown client');
    }

    // Step 3: Verify token signature + expiration
    const payload = await verifyToken<McpTokenPayload>(token, client.tokenSigningSecret);
    if (!payload) {
      throw new Error('Invalid or expired token');
    }
    return payload;
  });
  // Verify token expiration and refresh cache if expired
  if (payload.exp && payload.exp < Date.now()) {
    authCache.delete(key);
    throw new Error('Token has expired');
  }
  return payload;
};
