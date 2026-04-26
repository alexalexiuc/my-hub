CREATE TABLE IF NOT EXISTS "finance_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"opening_balance" numeric(18, 4) DEFAULT '0' NOT NULL,
	"balance" numeric(18, 4) DEFAULT '0' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_budget_members" (
	"budget_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_budget_members_budget_id_user_id_pk" PRIMARY KEY("budget_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_currency" text DEFAULT 'MDL' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"group_id" integer,
	"color" text,
	"icon" text,
	"monthly_target" numeric(18, 4),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_currency_rates" (
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"date" date NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_currency_rates_from_currency_to_currency_date_pk" PRIMARY KEY("from_currency","to_currency","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_net_worth_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"month" text NOT NULL,
	"total_assets" numeric(18, 4) NOT NULL,
	"total_liabilities" numeric(18, 4) NOT NULL,
	"net_worth" numeric(18, 4) NOT NULL,
	"breakdown" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_payees" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"type" text NOT NULL,
	"account_id" integer NOT NULL,
	"to_account_id" integer,
	"amount" numeric(18, 4) NOT NULL,
	"exchange_rate" numeric(18, 8) DEFAULT '1' NOT NULL,
	"date" date NOT NULL,
	"category_id" integer,
	"payee_id" integer,
	"notes" text,
	"extras" jsonb,
	"is_correction" boolean DEFAULT false NOT NULL,
	"from_account_balance_after" numeric(18, 4),
	"to_account_balance_after" numeric(18, 4),
	"added_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_budget_members" ADD CONSTRAINT "finance_budget_members_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_budget_members" ADD CONSTRAINT "finance_budget_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_group_id_finance_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."finance_groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_groups" ADD CONSTRAINT "finance_groups_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_net_worth_snapshots" ADD CONSTRAINT "finance_net_worth_snapshots_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_payees" ADD CONSTRAINT "finance_payees_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_to_account_id_finance_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_payee_id_finance_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."finance_payees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_accounts_budget" ON "finance_accounts" ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_accounts_type" ON "finance_accounts" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_budget_members_budget" ON "finance_budget_members" ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_budget_members_user" ON "finance_budget_members" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_categories_budget" ON "finance_categories" ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_categories_group" ON "finance_categories" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_groups_budget" ON "finance_groups" ("budget_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_finance_net_worth_budget_month" ON "finance_net_worth_snapshots" ("budget_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_net_worth_budget" ON "finance_net_worth_snapshots" ("budget_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_finance_payees_budget_name" ON "finance_payees" ("budget_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_budget" ON "finance_transactions" ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_account" ON "finance_transactions" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_to_account" ON "finance_transactions" ("to_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_date" ON "finance_transactions" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_category" ON "finance_transactions" ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_payee" ON "finance_transactions" ("payee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_added_by" ON "finance_transactions" ("added_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_budget_date" ON "finance_transactions" ("budget_id","date");