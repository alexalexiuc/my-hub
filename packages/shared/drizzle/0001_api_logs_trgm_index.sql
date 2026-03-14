-- Enable pg_trgm extension for trigram-based indexes (if not already enabled).
-- Enable required PostgreSQL extensions for this schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--> statement-breakpoint
-- Trigram GIN index on api_request_logs.error to support fuzzy search on error messages.
CREATE INDEX IF NOT EXISTS "api_request_logs_error_trgm_idx" ON "api_request_logs" USING GIN ("error" gin_trgm_ops);
