ALTER TABLE "oauth_clients" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;
