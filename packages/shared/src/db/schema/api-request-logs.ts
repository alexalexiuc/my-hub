import { bigserial, index, inet, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { oauthClients } from './oauth-clients';
import { McpServerName } from '../../constants';

export const apiRequestLogs = pgTable(
  'api_request_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    service: text('service').notNull(),
    server: text('server').$type<McpServerName>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code'),
    durationMs: integer('duration_ms'),
    ip: inet('ip'),
    userId: uuid('user_id'),
    clientId: text('client_id').references(() => oauthClients.clientId, { onDelete: 'set null' }),
    requestBody: jsonb('request_body'),
    responseBody: jsonb('response_body'),
    error: text('error'),
  },
  table => [
    index('idx_logs_created_at').on(table.createdAt),
    index('idx_logs_path').on(table.path),
    index('idx_logs_user').on(table.userId),
    index('idx_logs_status').on(table.statusCode),
    index('idx_logs_service').on(table.service),
    index('idx_logs_client').on(table.clientId.desc()),
    index('idx_logs_server').on(table.server),
  ],
);
