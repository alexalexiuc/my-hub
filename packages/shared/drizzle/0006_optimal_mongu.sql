CREATE TABLE "weekly_menu_day_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"meal_type" text NOT NULL,
	"logged_date" text NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_weekly_menu_day_log" UNIQUE("menu_id","day_of_week","meal_type")
);
--> statement-breakpoint
CREATE TABLE "weekly_menu_meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"meal_type" text NOT NULL,
	"description" text NOT NULL,
	"kcal" integer,
	"protein" real,
	"carbs" real,
	"fat" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_weekly_menu_meal_slot" UNIQUE("menu_id","day_of_week","meal_type")
);
--> statement-breakpoint
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
CREATE TABLE "weekly_menus" (
	"menu_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" text NOT NULL,
	"title" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calorie_profiles" ADD COLUMN "gym_days" jsonb;--> statement-breakpoint
ALTER TABLE "calorie_profiles" ADD COLUMN "gym_day_calorie_bonus" real DEFAULT 300;--> statement-breakpoint
ALTER TABLE "weekly_menu_day_logs" ADD CONSTRAINT "weekly_menu_day_logs_menu_id_weekly_menus_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."weekly_menus"("menu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_menu_meals" ADD CONSTRAINT "weekly_menu_meals_menu_id_weekly_menus_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."weekly_menus"("menu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_menu_shopping_items" ADD CONSTRAINT "weekly_menu_shopping_items_menu_id_weekly_menus_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."weekly_menus"("menu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_menu_shopping_items" ADD CONSTRAINT "weekly_menu_shopping_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_menus" ADD CONSTRAINT "weekly_menus_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_weekly_menu_meals_menu" ON "weekly_menu_meals" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "idx_weekly_menu_shopping_items_menu" ON "weekly_menu_shopping_items" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "idx_weekly_menus_user" ON "weekly_menus" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_weekly_menus_user_week" ON "weekly_menus" USING btree ("user_id","week_start" DESC NULLS LAST);