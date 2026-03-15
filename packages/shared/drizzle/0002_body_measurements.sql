-- Migrate body measurements out of calorie_profiles into dedicated tables
-- ---------------------------------------------------------------------------

-- 1. Create measurement_types lookup table
CREATE TABLE IF NOT EXISTS "measurement_types" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "unit" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "measurement_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint

-- 2. Seed default measurement types
INSERT INTO "measurement_types" ("key", "label", "unit") VALUES
  ('weight',    'Weight',              'kg'),
  ('height',    'Height',              'cm'),
  ('neck',      'Neck circumference',  'cm'),
  ('waist',     'Waist circumference', 'cm'),
  ('hips',      'Hips circumference',  'cm'),
  ('chest',     'Chest circumference', 'cm'),
  ('bicep',     'Bicep circumference', 'cm'),
  ('body_fat',  'Body fat',            '%')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

-- 3. Create body_measurements time-series table
CREATE TABLE IF NOT EXISTS "body_measurements" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "type_id" integer NOT NULL,
  "date" text NOT NULL,
  "value" real NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 4. Add foreign keys for body_measurements
DO $$ BEGIN
  ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_type_id_measurement_types_id_fk"
    FOREIGN KEY ("type_id") REFERENCES "public"."measurement_types"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- 5. Indexes for body_measurements
CREATE INDEX IF NOT EXISTS "idx_body_measurements_user"
  ON "body_measurements" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_body_measurements_date"
  ON "body_measurements" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_body_measurements_user_date"
  ON "body_measurements" ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_body_measurements_user_type"
  ON "body_measurements" ("user_id", "type_id");
--> statement-breakpoint

-- 6. Migrate existing calorie_profiles measurement columns into body_measurements
--    (only rows that have non-null values; uses today's date as measurement date)
INSERT INTO "body_measurements" ("user_id", "type_id", "date", "value")
SELECT cp."user_id",
       mt."id",
       to_char(CURRENT_DATE, 'YYYY-MM-DD'),
       cp."weight_kg"
FROM "calorie_profiles" cp
JOIN "measurement_types" mt ON mt."key" = 'weight'
WHERE cp."weight_kg" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "body_measurements" ("user_id", "type_id", "date", "value")
SELECT cp."user_id",
       mt."id",
       to_char(CURRENT_DATE, 'YYYY-MM-DD'),
       cp."height_cm"
FROM "calorie_profiles" cp
JOIN "measurement_types" mt ON mt."key" = 'height'
WHERE cp."height_cm" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "body_measurements" ("user_id", "type_id", "date", "value")
SELECT cp."user_id",
       mt."id",
       to_char(CURRENT_DATE, 'YYYY-MM-DD'),
       cp."neck_cm"
FROM "calorie_profiles" cp
JOIN "measurement_types" mt ON mt."key" = 'neck'
WHERE cp."neck_cm" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "body_measurements" ("user_id", "type_id", "date", "value")
SELECT cp."user_id",
       mt."id",
       to_char(CURRENT_DATE, 'YYYY-MM-DD'),
       cp."waist_cm"
FROM "calorie_profiles" cp
JOIN "measurement_types" mt ON mt."key" = 'waist'
WHERE cp."waist_cm" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "body_measurements" ("user_id", "type_id", "date", "value")
SELECT cp."user_id",
       mt."id",
       to_char(CURRENT_DATE, 'YYYY-MM-DD'),
       cp."hips_cm"
FROM "calorie_profiles" cp
JOIN "measurement_types" mt ON mt."key" = 'hips'
WHERE cp."hips_cm" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 7. Drop measurement columns from calorie_profiles
ALTER TABLE "calorie_profiles" DROP COLUMN IF EXISTS "height_cm";
--> statement-breakpoint
ALTER TABLE "calorie_profiles" DROP COLUMN IF EXISTS "weight_kg";
--> statement-breakpoint
ALTER TABLE "calorie_profiles" DROP COLUMN IF EXISTS "neck_cm";
--> statement-breakpoint
ALTER TABLE "calorie_profiles" DROP COLUMN IF EXISTS "waist_cm";
--> statement-breakpoint
ALTER TABLE "calorie_profiles" DROP COLUMN IF EXISTS "hips_cm";
