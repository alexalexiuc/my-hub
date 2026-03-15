-- Move height from body_measurements into calorie_profiles (height rarely changes)
ALTER TABLE "calorie_profiles"
  ADD COLUMN IF NOT EXISTS "height_cm" real;

-- Backfill: copy each user's most-recent height measurement into their profile row
UPDATE "calorie_profiles" cp
SET "height_cm" = bm.value
FROM "body_measurements" bm
JOIN "measurement_types" mt ON mt.id = bm.type_id
WHERE mt.key = 'height'
  AND bm.user_id = cp.user_id
  AND bm.id = (
    SELECT b2.id
    FROM "body_measurements" b2
    JOIN "measurement_types" mt2 ON mt2.id = b2.type_id
    WHERE b2.user_id = cp.user_id
      AND mt2.key = 'height'
    ORDER BY b2.date DESC, b2.id DESC
    LIMIT 1
  );
