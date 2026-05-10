ALTER TABLE "finance_categories" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "finance_payees" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_payees" ADD COLUMN "notes" text;