import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { mcpServers } from '../../db/schema/mcp-servers';
import type { McpServer } from '../../types/index';

const ALL_SERVER_NAMES = ['calories', 'hive', 'products'] as const;
export type McpServerName = (typeof ALL_SERVER_NAMES)[number];

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
