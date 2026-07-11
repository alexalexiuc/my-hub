CREATE TABLE "finance_account_balance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"date" date NOT NULL,
	"balance" numeric(18, 4) NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_account_balance_snapshots" ADD CONSTRAINT "finance_account_balance_snapshots_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_account_balance_snapshots" ADD CONSTRAINT "finance_account_balance_snapshots_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_account_balance_snapshots_account_date" ON "finance_account_balance_snapshots" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "idx_finance_account_balance_snapshots_budget_date" ON "finance_account_balance_snapshots" USING btree ("budget_id","date");