import { pgTable, serial, uuid, boolean, timestamp, unique, text } from 'drizzle-orm/pg-core';
import { type McpServerName } from '../../constants/mcp-servers';
import { users } from './users';

export const mcpServers = pgTable(
  'mcp_servers',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serverName: text('server_name').$type<McpServerName>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => [unique('uq_mcp_user_server').on(table.userId, table.serverName)],
);
