import { McpServerName } from '@my-hub/shared/constants';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import type { AuthInfo, OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { cachedFindUserById, cachedIsMcpServerEnabled, cachedVerifyToken } from '../cache';

const invalidToken = (message: string) => new OAuthError(OAuthErrorCode.InvalidToken, message);

/**
 * Creates a token verifier for the given MCP sub-server name, compatible with
 * fastify-mcp-server's `authorization.bearer.verifier` interface.
 *
 * Performs three checks beyond basic token verification:
 *  1. User exists in the database.
 *  2. MCP server is enabled for that user.
 *  3. (implicit) Token signature + expiration via cachedVerifyToken().
 *
 * Failures are thrown as `invalid_token` OAuth errors so the client gets a 401 with a
 * `WWW-Authenticate` challenge (and refreshes or re-authorises) — the SDK answers any
 * other error type with a 500.
 */
export function createHubTokenVerifier(serverName: McpServerName): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const payload = await cachedVerifyToken(token).catch((err: unknown) => {
        throw invalidToken(err instanceof Error ? err.message : 'Invalid token');
      });

      // Step 4: Verify user exists (cached)
      const user = await cachedFindUserById(payload.user_id);
      if (!user) {
        throw invalidToken('User not found');
      }

      // Step 5: Verify this MCP server is enabled for the user (cached)
      const enabled = await cachedIsMcpServerEnabled(payload.user_id, serverName);
      if (!enabled) {
        throw invalidToken(`MCP server "${serverName}" is not enabled for this user`);
      }

      return {
        token,
        clientId: payload.client_id,
        scopes: ['mcp:read', 'mcp:write'],
        expiresAt: payload.exp,
        extra: {
          userId: payload.user_id,
          email: payload.email,
          clientId: payload.client_id,
          serverName,
          timezone: user.timezone ?? null,
        },
      };
    },
  };
}
