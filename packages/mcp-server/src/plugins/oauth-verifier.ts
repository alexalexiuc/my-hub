import { McpServerName } from '@my-hub/shared/schema';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { cachedFindUserById, cachedIsMcpServerEnabled, cachedVerifyToken } from '../cache';

/**
 * Creates a token verifier for the given MCP sub-server name, compatible with
 * fastify-mcp-server's `authorization.bearerMiddlewareOptions.verifier` interface.
 *
 * Performs three checks beyond basic token verification:
 *  1. User exists in the database.
 *  2. MCP server is enabled for that user.
 *  3. (implicit) Token signature + expiration via cachedVerifyToken().
 */
export function createHubTokenVerifier(serverName: McpServerName) {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const payload = await cachedVerifyToken(token);

      // Step 4: Verify user exists (cached)
      const user = await cachedFindUserById(payload.user_id);
      if (!user) {
        throw new Error('User not found');
      }

      // Step 5: Verify this MCP server is enabled for the user (cached)
      const enabled = await cachedIsMcpServerEnabled(payload.user_id, serverName);
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
          clientId: payload.client_id,
          serverName,
        },
      };
    },
  };
}

/** Pre-built verifier instances for each sub-server. */
export const caloriesVerifier = createHubTokenVerifier(McpServerName.Calories);
export const todoVerifier = createHubTokenVerifier(McpServerName.Todo);
