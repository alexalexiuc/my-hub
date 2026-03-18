import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { mcpServers } from '../../db/schema/mcp-servers';
import type { McpServer } from '../../types/index';

/**
 * Enum-like const object for MCP server names.
 * Use `McpServerName.Calories` instead of the string literal `'calories'`.
 * The companion type `McpServerName` stays a plain string union so it remains
 * compatible with Drizzle column types and existing runtime code.
 */
export const McpServerName = {
  Calories: 'calories',
  Hive: 'hive',
  Products: 'products',
  Todo: 'todo',
} as const;

export type McpServerName = (typeof McpServerName)[keyof typeof McpServerName];

const ALL_SERVER_NAMES = Object.values(McpServerName) as McpServerName[];

/**
 * Ensure a row exists for every known server type for the given user.
 * Uses ON CONFLICT DO NOTHING so it is safe to call on every authorization.
 */
export async function ensureAllMcpServers(userId: string): Promise<void> {
  for (const serverName of ALL_SERVER_NAMES) {
    await db.insert(mcpServers).values({ userId, serverName, enabled: true }).onConflictDoNothing();
  }
}

/** Returns all MCP server rows for a user, ensuring all types exist first. */
export async function getMcpServers(userId: string): Promise<McpServer[]> {
  await ensureAllMcpServers(userId);
  return db.query.mcpServers.findMany({
    where: eq(mcpServers.userId, userId),
    orderBy: mcpServers.serverName,
  });
}

/** Returns true if the named MCP server is enabled for the user (returns false if row does not exist). */
export async function isMcpServerEnabled(userId: string, serverName: McpServerName): Promise<boolean> {
  const row = await db.query.mcpServers.findFirst({
    where: and(eq(mcpServers.userId, userId), eq(mcpServers.serverName, serverName)),
  });
  return row?.enabled ?? false;
}

/** Toggle enabled state for a specific MCP server. */
export async function setMcpServerEnabled(
  userId: string,
  serverName: McpServerName,
  enabled: boolean,
): Promise<McpServer> {
  const [row] = await db
    .update(mcpServers)
    .set({ enabled })
    .where(and(eq(mcpServers.userId, userId), eq(mcpServers.serverName, serverName)))
    .returning();
  if (!row) throw new Error('MCP server row not found');
  return row;
}
