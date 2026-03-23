ALTER TABLE "api_request_logs" ADD COLUMN "server" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_server" ON "api_request_logs" ("server");