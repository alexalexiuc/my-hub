import { pgTable, pgEnum, serial, uuid, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { mcpServerNameValues } from '../../constants/mcp-servers';
export { McpServerName, mcpServerNameValues } from '../../constants/mcp-servers';
import { users } from './users';

export const mcpServerEnum = pgEnum('mcp_server', mcpServerNameValues);

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
