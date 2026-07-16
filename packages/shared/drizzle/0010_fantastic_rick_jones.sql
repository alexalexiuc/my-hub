CREATE TABLE "weekly_menu_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"shared_with_user_id" uuid NOT NULL,
	"permission" text DEFAULT 'view' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_menu_shares" ADD CONSTRAINT "weekly_menu_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_menu_shares" ADD CONSTRAINT "weekly_menu_shares_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_weekly_menu_shares_owner_shared_with" ON "weekly_menu_shares" USING btree ("owner_user_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX "idx_weekly_menu_shares_shared_with_user_id" ON "weekly_menu_shares" USING btree ("shared_with_user_id");