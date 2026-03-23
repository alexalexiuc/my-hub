import { pgTable, pgEnum, serial, uuid, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Enum-like const object for MCP server names.
 * Use `McpServerName.Calories` instead of the string literal `'calories'`.
 * The companion type `McpServerName` stays a plain string union so it remains
 * compatible with Drizzle column types and existing runtime code.
 */
export const McpServerName = {
  Apiary: 'apiary',
  Calories: 'calories',
  Products: 'products',
  Todo: 'todo',
} as const;

export type McpServerName = (typeof McpServerName)[keyof typeof McpServerName];

export const mcpServerEnum = pgEnum('mcp_server', [
  McpServerName.Apiary,
  McpServerName.Calories,
  McpServerName.Products,
  McpServerName.Todo,
]);

export const mcpServers = pgTable(
  'mcp_servers',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serverName: mcpServerEnum('server_name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userServerUniq: unique('uq_mcp_user_server').on(table.userId, table.serverName),
  }),
);
