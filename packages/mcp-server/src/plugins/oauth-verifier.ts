import { verifyToken } from '@my-hub/shared/auth';
import { findOAuthClient } from '@my-hub/shared/services';

interface AccessTokenPayload {
  client_id: string;
  user_id: string;
  exp: number;
}

/**
 * Token verifier compatible with fastify-mcp-server's
 * authorization.bearerMiddlewareOptions.verifier interface.
 *
 * Verifies access tokens issued by the hub's POST /token endpoint.
 *
 * Flow:
 *  1. Decode the token payload (base64url) without signature verification
 *     to extract client_id.
 *  2. Look up the OAuth client by client_id to retrieve tokenSigningSecret.
 *  3. Verify the full token signature + expiration with the client's secret.
 *  4. Return auth info on success, throw on failure.
 *
 * Note: @my-hub/shared/auth uses HMAC-SHA256, not JWT.
 * Token format: base64url(JSON payload) + "." + base64url(HMAC sig)
 * This matches option (a) in the issue — decode payload before signature check.
 */
export const hubTokenVerifier = {
  async verifyAccessToken(token: string) {
    // Step 1: Decode payload without verification to extract client_id
    let clientId: string;
    try {
      const dot = token.indexOf('.');
      if (dot === -1) throw new Error('Malformed token: missing dot separator');
      const payloadB64 = token.slice(0, dot);
      // Restore base64 standard chars and add padding — matches shared base64urlDecode helper
      const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Partial<AccessTokenPayload>;
      if (!decoded.client_id) throw new Error('Missing client_id in token payload');
      clientId = decoded.client_id;
    } catch (err) {
      throw new Error(`Invalid token format: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 2: Look up OAuth client to get tokenSigningSecret
    const client = await findOAuthClient(clientId);
    if (!client) {
      throw new Error('Unknown client');
    }

    // Step 3: Verify token signature + expiration with client's secret
    const payload = await verifyToken<AccessTokenPayload>(token, client.tokenSigningSecret);
    if (!payload) {
      throw new Error('Invalid or expired token');
    }

    // Step 4: Additional expiration check (belt-and-suspenders).
    // Note: exp is stored as Unix milliseconds (Date.now() + ms), not Unix seconds.
    // verifyToken() already checks exp, but this guard is kept as an explicit safety net.
    if (payload.exp && payload.exp < Date.now()) {
      throw new Error('Token has expired');
    }

    // Step 5: Return auth info for downstream use (available in tool handlers as authInfo)
    return {
      token,
      clientId: payload.client_id,
      scopes: ['mcp:read', 'mcp:write'],
      expiresAt: payload.exp,
      extra: {
        userId: payload.user_id,
      },
    };
  },
};
