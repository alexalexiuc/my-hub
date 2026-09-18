-- Backfill the goal baseline for profiles that already have a goal.
--
-- Before this, the weekly progress projection re-anchored to each week's first weigh-in, so no
-- baseline was ever stored. Existing users would otherwise fall back to an inferred anchor until
-- they next touched their goal.
--
-- The anchor is each user's OLDEST weigh-in within the last 8 weeks — recent enough that it
-- describes the goal run they are actually on, rather than back-projecting a target from a weight
-- they logged a year ago, and old enough to give the line somewhere to start. Users with no
-- weigh-in in that window are left NULL and fall back to the inferred anchor in app code.

UPDATE "calorie_profiles" p
SET "goal_start_date" = m."date"::date,
    "goal_start_weight_kg" = m."value"
FROM (
  SELECT DISTINCT ON (bm."user_id")
         bm."user_id",
         bm."date",
         bm."value"
  FROM "body_measurements" bm
  WHERE bm."type_key" = 'weight'
    AND bm."date" >= to_char(CURRENT_DATE - INTERVAL '56 days', 'YYYY-MM-DD')
  ORDER BY bm."user_id", bm."date" ASC, bm."id" ASC
) m
WHERE p."user_id" = m."user_id"
  AND p."goal_type" IS NOT NULL
  AND p."goal_start_date" IS NULL;
