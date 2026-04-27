DROP INDEX IF EXISTS "uq_finance_payees_budget_name";--> statement-breakpoint
ALTER TABLE "finance_payees" ADD COLUMN "normalized_name" text;--> statement-breakpoint
UPDATE "finance_payees" SET "normalized_name" = lower(trim("name"));--> statement-breakpoint
ALTER TABLE "finance_payees" ALTER COLUMN "normalized_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_payees" ADD COLUMN "stats_by_user" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_finance_payees_budget_norm" ON "finance_payees" ("budget_id","normalized_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_payees_budget" ON "finance_payees" ("budget_id");