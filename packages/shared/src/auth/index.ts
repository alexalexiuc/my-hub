/**
 * Auth utilities shared between mcp-server and admin.
 *
 * Placeholder — actual OAuth / JWT logic will be migrated from the old
 * hive-manager-mcp-server in a follow-up.
 */

export interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
  scope: string[];
}

/**
 * Placeholder — verify a Bearer token and return its payload.
 * TODO: implement with jose / jsonwebtoken in the follow-up.
 */
export async function verifyToken(_token: string): Promise<TokenPayload> {
  throw new Error("verifyToken: not yet implemented");
}

/**
 * Placeholder — generate a short-lived access token.
 * TODO: implement in follow-up.
 */
export async function signToken(
  _payload: Omit<TokenPayload, "iat" | "exp">,
): Promise<string> {
  throw new Error("signToken: not yet implemented");
}
