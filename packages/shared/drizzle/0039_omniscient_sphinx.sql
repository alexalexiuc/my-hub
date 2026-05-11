CREATE TABLE IF NOT EXISTS "finance_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_import_batches" ADD CONSTRAINT "finance_import_batches_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_import_batches" ADD CONSTRAINT "finance_import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_import_batches_budget" ON "finance_import_batches" ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_import_batches_user" ON "finance_import_batches" ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_import_batch_id_finance_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."finance_import_batches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_import_batch" ON "finance_transactions" ("import_batch_id");