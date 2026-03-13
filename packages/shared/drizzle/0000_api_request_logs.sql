CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE TABLE IF NOT EXISTS api_request_logs (
  id BIGSERIAL PRIMARY KEY,
  service TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INT,
  duration_ms INT,
  ip INET,
  user_id UUID,
  request_body JSONB,
  response_body JSONB,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at
ON api_request_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_logs_path
ON api_request_logs (path);

CREATE INDEX IF NOT EXISTS idx_logs_user
ON api_request_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_logs_status
ON api_request_logs (status_code);

CREATE INDEX IF NOT EXISTS idx_logs_service
ON api_request_logs (service);

CREATE INDEX IF NOT EXISTS idx_logs_error_trgm
ON api_request_logs
USING GIN (error gin_trgm_ops);

-- Retention cleanup query (run via scheduled job):
-- DELETE FROM api_request_logs
-- WHERE created_at < now() - interval '30 days';
