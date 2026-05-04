ALTER TABLE "calorie_profiles" ADD COLUMN "automation_api_key" text;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "entry_source" text DEFAULT 'hub' NOT NULL;