CREATE TABLE "finance_account_availability" (
	"user_id" uuid NOT NULL,
	"account_id" integer NOT NULL,
	"include" boolean NOT NULL,
	CONSTRAINT "finance_account_availability_user_id_account_id_pk" PRIMARY KEY("user_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "finance_account_availability" ADD CONSTRAINT "finance_account_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_account_availability" ADD CONSTRAINT "finance_account_availability_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;