-- Migrate trip_bookings.details:
-- 1. Fix double-encoding: details was stored as a JSONB string containing a JSON string,
--    not as a JSONB object. Parse the inner string to a proper JSONB object.
-- 2. Rename snake_case keys to camelCase to align with TypeScript interfaces.
-- 3. Add kind discriminators where missing.
--
-- All WHERE clauses check jsonb_typeof(details) = 'string' so the migration is idempotent.

-- Flight rows with nl_import source (raw_text → rawText, add kind: 'flight')
UPDATE trip_bookings
SET details = (
  (details #>> '{}')::jsonb
  - 'raw_text'
  || jsonb_build_object(
    'kind',    'flight',
    'rawText', (details #>> '{}')::jsonb ->> 'raw_text'
  )
)
WHERE booking_type = 'flight'
  AND jsonb_typeof(details) = 'string'
  AND ((details #>> '{}')::jsonb) ? 'raw_text';

-- Flight rows with structured IATA data (rename keys, add kind: 'flight')
UPDATE trip_bookings
SET details = (
  (details #>> '{}')::jsonb
  - 'flight_number'
  - 'origin_iata'
  - 'destination_iata'
  || jsonb_build_object(
    'kind',             'flight',
    'flightNumber',     (details #>> '{}')::jsonb ->> 'flight_number',
    'originIata',       (details #>> '{}')::jsonb ->> 'origin_iata',
    'destinationIata',  (details #>> '{}')::jsonb ->> 'destination_iata'
  )
)
WHERE booking_type = 'flight'
  AND jsonb_typeof(details) = 'string'
  AND ((details #>> '{}')::jsonb) ? 'flight_number';

-- Car/transport rows already have correct camelCase keys and kind: 'transport'.
-- Only fix the double-encoding.
UPDATE trip_bookings
SET details = (details #>> '{}')::jsonb
WHERE booking_type = 'car'
  AND jsonb_typeof(details) = 'string';

-- All other booking types (accommodation, taxi, bus, train, ferry, etc.)
-- with nl_import raw text: kind: 'base', raw_text → rawText
UPDATE trip_bookings
SET details = (
  (details #>> '{}')::jsonb
  - 'raw_text'
  || jsonb_build_object(
    'kind',    'base',
    'rawText', (details #>> '{}')::jsonb ->> 'raw_text'
  )
)
WHERE booking_type NOT IN ('flight', 'car')
  AND jsonb_typeof(details) = 'string'
  AND ((details #>> '{}')::jsonb) ? 'raw_text';
