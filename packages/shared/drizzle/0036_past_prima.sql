ALTER TABLE "finance_categories" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD COLUMN "source" text DEFAULT 'hub' NOT NULL;