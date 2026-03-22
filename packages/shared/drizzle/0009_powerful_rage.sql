ALTER TABLE "api_request_logs" ADD COLUMN "client_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_client" ON "api_request_logs" ("client_id");