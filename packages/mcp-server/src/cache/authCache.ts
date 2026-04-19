import { verifyToken, decodeTokenPayload, McpTokenPayload } from '@my-hub/shared/auth';
import { findOAuthClient } from '@my-hub/shared/services';
import { PromiseCacheX } from 'promise-cachex';
import { createHash } from 'node:crypto';

const AUTH_CACHE_TTL = 60_000 * 60 * 1; // 60 minutes

const authCache = new PromiseCacheX<McpTokenPayload & { exp?: number }>({
  ttl: AUTH_CACHE_TTL,
});

function toTokenCacheKey(token: string): string {
  const digest = createHash('sha256').update(token).digest('base64url');
  return `token:${digest}`;
}

export const cachedVerifyToken = async (token: string): Promise<McpTokenPayload & { exp?: number }> => {
  const key = toTokenCacheKey(token);

  let isCacheMiss = false;
  const payload = await authCache.get(key, async () => {
    isCacheMiss = true;
    // Step 1: Decode payload (no signature check yet) to extract client_id
    let clientId: string;
    try {
      const rawPayload = decodeTokenPayload<McpTokenPayload>(token);
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
    const verified = await verifyToken<McpTokenPayload>(token, client.tokenSigningSecret);
    if (!verified) {
      throw new Error('Invalid or expired token');
    }
    return verified;
  });

  // Correct the cache TTL to match token expiry — authCache.get stored with default TTL.
  // Only on a cache miss; hits already have the correct TTL from the initial set.
  if (isCacheMiss && payload.exp) {
    const ttl = Math.max(0, payload.exp * 1000 - Date.now());
    authCache.set(key, payload, { ttl });
  }

  return payload;
};
