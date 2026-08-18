ALTER TABLE "weekly_menu_meals" ADD COLUMN "week_start" text;--> statement-breakpoint
UPDATE "weekly_menu_meals" m SET "week_start" = wm."week_start" FROM "weekly_menus" wm WHERE wm."menu_id" = m."menu_id";--> statement-breakpoint
ALTER TABLE "weekly_menu_meals" ALTER COLUMN "week_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_menu_meals" ADD COLUMN "date" text GENERATED ALWAYS AS (("weekly_menu_meals"."week_start"::date + ("weekly_menu_meals"."day_of_week"::text || ' days')::interval)::date::text) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_weekly_menu_meals_date" ON "weekly_menu_meals" USING btree ("date");
