CREATE TABLE "weekly_menu_shopping_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_weekly_menu_shopping_item" UNIQUE("menu_id","text")
);
--> statement-breakpoint
ALTER TABLE "weekly_menu_shopping_items" ADD CONSTRAINT "weekly_menu_shopping_items_menu_id_weekly_menus_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."weekly_menus"("menu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_menu_shopping_items" ADD CONSTRAINT "weekly_menu_shopping_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_weekly_menu_shopping_items_menu" ON "weekly_menu_shopping_items" USING btree ("menu_id");