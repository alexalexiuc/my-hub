CREATE TABLE "weekly_menu_day_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"logged_date" text NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_weekly_menu_day_log" UNIQUE("menu_id","day_of_week")
);
--> statement-breakpoint
ALTER TABLE "weekly_menu_day_logs" ADD CONSTRAINT "weekly_menu_day_logs_menu_id_weekly_menus_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."weekly_menus"("menu_id") ON DELETE cascade ON UPDATE no action;