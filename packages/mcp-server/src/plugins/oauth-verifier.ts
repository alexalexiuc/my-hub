import { PromiseCacheX } from 'promise-cachex';
import { verifyToken } from '@my-hub/shared/auth';
import { findOAuthClient, findUserById, isMcpServerEnabled } from '@my-hub/shared/services';
import { McpServerName } from '@my-hub/shared/schema';

interface AccessTokenPayload {
  client_id: string;
  user_id: string;
  email?: string;
  exp: number;
}

// Cache user lookups and server-enabled state for 60 seconds to avoid a DB
// round-trip on every MCP tool call while still picking up changes quickly.
const userCache = new PromiseCacheX<Awaited<ReturnType<typeof findUserById>>>({ ttl: 60_000 });
const serverEnabledCache = new PromiseCacheX<boolean>({ ttl: 60_000 });

/**
 * Creates a token verifier for the given MCP sub-server name, compatible with
 * fastify-mcp-server's `authorization.bearerMiddlewareOptions.verifier` interface.
 *
 * Performs three checks beyond basic token verification:
 *  1. User exists in the database.
 *  2. MCP server is enabled for that user.
 *  3. (implicit) Token signature + expiration via verifyToken().
 */
export function createHubTokenVerifier(serverName: McpServerName) {
  return {
    async verifyAccessToken(token: string) {
      // Step 1: Decode payload (no signature check yet) to extract client_id
      let clientId: string;
      let rawPayload: Partial<AccessTokenPayload>;
      try {
        const dot = token.indexOf('.');
        if (dot === -1) throw new Error('Malformed token: missing dot separator');
        const payloadB64 = token.slice(0, dot);
        const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        rawPayload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Partial<AccessTokenPayload>;
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
      const payload = await verifyToken<AccessTokenPayload>(token, client.tokenSigningSecret);
      if (!payload) {
        throw new Error('Invalid or expired token');
      }
      if (payload.exp && payload.exp < Date.now()) {
        throw new Error('Token has expired');
      }

      // Step 4: Verify user exists (cached)
      const user = await userCache.get(payload.user_id, () => findUserById(payload.user_id));
      if (!user) {
        throw new Error('User not found');
      }

      // Step 5: Verify this MCP server is enabled for the user (cached)
      const enabled = await serverEnabledCache.get(`${payload.user_id}:${serverName}`, () =>
        isMcpServerEnabled(payload.user_id, serverName),
      );
      if (!enabled) {
        throw new Error(`MCP server "${serverName}" is not enabled for this user`);
      }

      return {
        token,
        clientId: payload.client_id,
        scopes: ['mcp:read', 'mcp:write'],
        expiresAt: payload.exp,
        extra: {
          userId: payload.user_id,
          email: payload.email,
        },
      };
    },
  };
}

/** Pre-built verifier instances for each sub-server. */
export const caloriesVerifier = createHubTokenVerifier(McpServerName.Calories);
export const todoVerifier = createHubTokenVerifier(McpServerName.Todo);
