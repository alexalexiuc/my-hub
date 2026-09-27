CREATE TABLE "vacation_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"country" text NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "uq_vacation_holidays_scope" UNIQUE("user_id","date","country","region")
);
--> statement-breakpoint
CREATE TABLE "vacation_leave_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text NOT NULL,
	"pay_received_mdl" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"region" text,
	"employer" text NOT NULL,
	"opening_balance_days" real NOT NULL,
	"opening_balance_date" date NOT NULL,
	"accrual_start" date,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation_rule_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"region" text,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"leave_unit" text NOT NULL,
	"annual_entitlement_days" real NOT NULL,
	"avg_window_months" integer DEFAULT 3 NOT NULL,
	"rate_basis" text NOT NULL,
	"raise_resets_window" boolean DEFAULT true NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation_salary_months" (
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"base_mdl" real NOT NULL,
	"extra_mdl" real DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vacation_salary_months_user_id_month_pk" PRIMARY KEY("user_id","month")
);
--> statement-breakpoint
CREATE TABLE "vacation_tax_regimes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"employer" text NOT NULL,
	"regime" text NOT NULL,
	"medical_rate" real NOT NULL,
	"income_tax_rate" real NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date
);
--> statement-breakpoint
ALTER TABLE "vacation_holidays" ADD CONSTRAINT "vacation_holidays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_leave_periods" ADD CONSTRAINT "vacation_leave_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_profiles" ADD CONSTRAINT "vacation_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_rule_sets" ADD CONSTRAINT "vacation_rule_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_salary_months" ADD CONSTRAINT "vacation_salary_months_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_tax_regimes" ADD CONSTRAINT "vacation_tax_regimes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vacation_leave_periods_user_start_idx" ON "vacation_leave_periods" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "vacation_rule_sets_user_idx" ON "vacation_rule_sets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vacation_tax_regimes_user_idx" ON "vacation_tax_regimes" USING btree ("user_id");