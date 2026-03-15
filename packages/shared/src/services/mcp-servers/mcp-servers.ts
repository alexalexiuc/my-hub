import { db } from '../../db/client';
import { mcpServers } from '../../db/schema/mcp-servers';

const ALL_SERVER_NAMES = ['calories', 'hive', 'products'] as const;

/**
 * Ensure a row exists for every known server type for the given user.
 * Uses ON CONFLICT DO NOTHING so it is safe to call on every authorization.
 */
export async function ensureAllMcpServers(userId: string): Promise<void> {
  for (const serverName of ALL_SERVER_NAMES) {
    await db.insert(mcpServers).values({ userId, serverName, enabled: true }).onConflictDoNothing();
  }
}
