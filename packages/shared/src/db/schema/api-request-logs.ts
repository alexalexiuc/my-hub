import { bigserial, index, inet, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const apiRequestLogs = pgTable(
  "api_request_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    service: text("service").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code"),
    durationMs: integer("duration_ms"),
    ip: inet("ip"),
    userId: uuid("user_id"),
    requestBody: jsonb("request_body"),
    responseBody: jsonb("response_body"),
    error: text("error"),
  },
  (table) => ({
    createdAtIdx: index("idx_logs_created_at").on(table.createdAt),
    pathIdx: index("idx_logs_path").on(table.path),
    userIdx: index("idx_logs_user").on(table.userId),
    statusIdx: index("idx_logs_status").on(table.statusCode),
    serviceIdx: index("idx_logs_service").on(table.service),
  }),
);
