CREATE TABLE "finance_portfolio_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" integer NOT NULL,
	"date" date NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_portfolio_notes" ADD CONSTRAINT "finance_portfolio_notes_portfolio_id_finance_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."finance_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_finance_portfolio_notes_portfolio_date" ON "finance_portfolio_notes" USING btree ("portfolio_id","date");