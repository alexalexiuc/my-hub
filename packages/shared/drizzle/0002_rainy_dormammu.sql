CREATE TABLE "finance_labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD COLUMN "labels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_labels" ADD CONSTRAINT "finance_labels_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_labels_budget_label" ON "finance_labels" USING btree ("budget_id","label");--> statement-breakpoint
CREATE INDEX "idx_finance_labels_budget" ON "finance_labels" USING btree ("budget_id");