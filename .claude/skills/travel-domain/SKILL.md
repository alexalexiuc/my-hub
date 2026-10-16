---
name: travel-domain
description: |
  Domain rules for the travel feature — load before changing packages/shared/src/services/travel, the travel
  schema/constants, packages/hub/src/app/travel, travel API routes, packages/mcp-server/src/travel, or the
  worker's flight-data polling. Covers booking types and their details JSONB, the two booking display paths,
  sharing/access, and flight data.
metadata:
  scope: monorepo
  stage: implementation
---

# Travel domain

Exports: `pnpm inventory packages/shared/src/services/travel --docs`. Specs:
`docs/requirements/hub/feature-my-travels.md`, `docs/requirements/mcps/feature-travel-management.md`.

## Bookings

- `trip_bookings.details` (JSONB) is the extension point for type-specific fields — never add columns for them.
  Each shape is an interface in `packages/shared/src/types/index.ts` with a `readonly kind: '<type>'`
  discriminator (`FlightDetails` `kind: 'flight'`, `TransportDetails` `kind: 'transport'`). These keep their
  persisted snake_case fields.
- New booking type: add it to `TripBookingTypes` (`src/constants/travel.ts`), then update hub
  `BookingTypeIcon.tsx` and the `switch`es in both display paths below.
- **Two independent display paths — change both:**
  - `packages/hub/src/app/travel/coming-next.utils.ts` — "Coming Next" timeline (labels, endpoints, navigate URLs)
  - `packages/hub/src/app/travel/BookingsSection.tsx` — reservations list + add/edit form
- Historical naming: the booking POST/PATCH API takes `body.flightDetails` for **every** details shape and stores
  it as `details`. Pass new shapes as `flightDetails` too.
- Coordinates are validated on insert/update (`validateCoords`: range checks, both-or-neither).

## Access

- Trips are owned by `user_id`; shares (`shares.ts`) grant read access. Use `getAccessibleTrips` /
  `getTripByIdAccessible` / `verifyTripAccess` for reads and `verifyTripOwnership` for writes.
  `deleteAllUserTripShares` handles the shared-with side on account deletion.
- Day notes: `upsertTripDay` keeps existing `placeIds` when none are passed (COALESCE).

## Flight data

- AeroDataBox via RapidAPI (`flightDataApi.ts`): 600 requests/month, needs `RAPIDAPI_KEY` (empty disables it).
  The worker polls `getFlightDataDueForFetch`; `computeNextFetchAt` / `backOffFlightData` ration the quota — keep
  new callers going through them.

## UI and tests

- Hub: `packages/hub/src/app/travel/` (sections + `types.ts` + `coming-next.utils.ts` — the reference layout for
  hub feature folders). Map uses maplibre (worker file copied by `copy:maplibre-worker`).
- Specs: `packages/e2e/tests/travel-*.spec.ts` (+ `travel-helpers.ts`); shared-trip read-only view uses
  `SHARED_TRIP_FIXTURE`. MCP: `packages/mcp-server/e2e/travel.e2e.ts`.
