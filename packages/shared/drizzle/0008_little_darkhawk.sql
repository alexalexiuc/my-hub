CREATE TABLE "finance_portfolio_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"name" text,
	"yahoo_symbol" text NOT NULL,
	"stooq_symbol" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"target_allocation_pct" numeric(8, 4) DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_portfolio_supplies" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" integer NOT NULL,
	"date" date NOT NULL,
	"total_amount" numeric(18, 4) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_portfolio_supply_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"supply_id" integer NOT NULL,
	"position_id" integer NOT NULL,
	"type" text DEFAULT 'buy' NOT NULL,
	"units" numeric(18, 8) NOT NULL,
	"price_per_unit" numeric(18, 6) NOT NULL,
	"fee" numeric(18, 4) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_portfolios" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text DEFAULT 'Portfolio' NOT NULL,
	"base_currency" text DEFAULT 'EUR' NOT NULL,
	"pessimistic_annual_return_pct" numeric(8, 4) DEFAULT 4 NOT NULL,
	"expected_annual_return_pct" numeric(8, 4) DEFAULT 7 NOT NULL,
	"optimistic_annual_return_pct" numeric(8, 4) DEFAULT 10 NOT NULL,
	"planned_monthly_contribution" numeric(18, 4) DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_ticker_prices" (
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"close" numeric(18, 6) NOT NULL,
	"currency" text NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_ticker_prices_symbol_date_pk" PRIMARY KEY("symbol","date")
);
--> statement-breakpoint
ALTER TABLE "finance_portfolio_positions" ADD CONSTRAINT "finance_portfolio_positions_portfolio_id_finance_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."finance_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_portfolio_supplies" ADD CONSTRAINT "finance_portfolio_supplies_portfolio_id_finance_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."finance_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_portfolio_supply_lines" ADD CONSTRAINT "finance_portfolio_supply_lines_supply_id_finance_portfolio_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."finance_portfolio_supplies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_portfolio_supply_lines" ADD CONSTRAINT "finance_portfolio_supply_lines_position_id_finance_portfolio_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."finance_portfolio_positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_portfolios" ADD CONSTRAINT "finance_portfolios_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_portfolio_positions_symbol" ON "finance_portfolio_positions" USING btree ("portfolio_id","symbol");--> statement-breakpoint
CREATE INDEX "idx_finance_portfolio_positions_portfolio" ON "finance_portfolio_positions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_finance_portfolio_supplies_portfolio_date" ON "finance_portfolio_supplies" USING btree ("portfolio_id","date");--> statement-breakpoint
CREATE INDEX "idx_finance_portfolio_supply_lines_supply" ON "finance_portfolio_supply_lines" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "idx_finance_portfolio_supply_lines_position" ON "finance_portfolio_supply_lines" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_finance_portfolios_budget" ON "finance_portfolios" USING btree ("budget_id");