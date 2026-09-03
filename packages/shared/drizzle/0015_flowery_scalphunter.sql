ALTER TABLE "finance_accounts" ADD COLUMN "show_on_widget" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD COLUMN "widget_sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_categories" ADD COLUMN "include_in_spending_budget" boolean DEFAULT true NOT NULL;