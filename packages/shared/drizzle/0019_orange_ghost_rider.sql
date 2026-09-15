ALTER TABLE "finance_portfolios" ADD COLUMN "cadence_anchor_month" text;--> statement-breakpoint
ALTER TABLE "finance_portfolios" ADD COLUMN "cadence_tolerance_pct" numeric(8, 4) DEFAULT 10 NOT NULL;