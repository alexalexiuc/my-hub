ALTER TABLE "weekly_menu_day_logs" DROP CONSTRAINT "uq_weekly_menu_day_log";--> statement-breakpoint
ALTER TABLE "calorie_profiles" ALTER COLUMN "gym_days" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "weekly_menu_day_logs" ADD COLUMN "meal_type" text NOT NULL DEFAULT 'breakfast';--> statement-breakpoint
ALTER TABLE "weekly_menu_day_logs" ALTER COLUMN "meal_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "weekly_menu_day_logs" ADD CONSTRAINT "uq_weekly_menu_day_log" UNIQUE("menu_id","day_of_week","meal_type");