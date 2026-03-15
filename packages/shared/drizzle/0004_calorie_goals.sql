-- Add structured calorie goals to calorie_profiles
-- Replaces the single goal_calories_override with:
--   goal_type             – 'weight_loss' | 'weight_gain' | 'maintain'
--   goal_weekly_rate_kg   – weekly loss/gain rate in kg (e.g. 0.5)
--   goal_min_calories     – explicit daily minimum floor
--   goal_max_calories     – explicit daily maximum ceiling

ALTER TABLE "calorie_profiles"
  ADD COLUMN IF NOT EXISTS "goal_type" text,
  ADD COLUMN IF NOT EXISTS "goal_weekly_rate_kg" real,
  ADD COLUMN IF NOT EXISTS "goal_min_calories" integer,
  ADD COLUMN IF NOT EXISTS "goal_max_calories" integer;
--> statement-breakpoint

-- Migrate any existing manual override into the new max column
UPDATE "calorie_profiles"
  SET "goal_max_calories" = "goal_calories_override"
  WHERE "goal_calories_override" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "calorie_profiles"
  DROP COLUMN IF EXISTS "goal_calories_override";
