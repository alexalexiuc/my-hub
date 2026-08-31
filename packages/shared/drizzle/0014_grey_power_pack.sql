ALTER TABLE "meal_logs" ALTER COLUMN "date" SET DATA TYPE date USING "date"::date;--> statement-breakpoint
ALTER TABLE "weekly_menu_day_logs" ALTER COLUMN "logged_date" SET DATA TYPE date USING "logged_date"::date;--> statement-breakpoint
ALTER TABLE "weekly_menus" ALTER COLUMN "week_start" SET DATA TYPE date USING "week_start"::date;
