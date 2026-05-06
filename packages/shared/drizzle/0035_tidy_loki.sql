CREATE TABLE IF NOT EXISTS "finance_monthly_plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"currency" text NOT NULL,
	"category_id" integer,
	"merchant_id" integer,
	"linked_account_id" integer,
	"assigned_amount" numeric(18, 4) DEFAULT 0 NOT NULL,
	"is_assigned" boolean DEFAULT false NOT NULL,
	"assigned_transaction_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_monthly_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"month" text NOT NULL,
	"available_amount" numeric(18, 4) NOT NULL,
	"income_account_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD COLUMN "description" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_plan_id_finance_monthly_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_monthly_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_merchant_id_finance_payees_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."finance_payees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_linked_account_id_finance_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_assigned_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("assigned_transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_monthly_plans" ADD CONSTRAINT "finance_monthly_plans_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_monthly_plans" ADD CONSTRAINT "finance_monthly_plans_income_account_id_finance_accounts_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_plan_items_plan" ON "finance_monthly_plan_items" ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_plan_items_linked_account" ON "finance_monthly_plan_items" ("linked_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_finance_monthly_plan_budget_month" ON "finance_monthly_plans" ("budget_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_monthly_plans_budget" ON "finance_monthly_plans" ("budget_id");