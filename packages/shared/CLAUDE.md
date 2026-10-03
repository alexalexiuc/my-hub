# shared package — Agent Guidelines

## Where the inventories live

- `src/utils/CLAUDE.md` — every utility file and its exports. **Read it before writing any helper** in any package:
  if a general-purpose function (string, number, date, array…) is missing, it belongs in `src/utils/`.
- `src/services/CLAUDE.md` — every service file per domain. Read it before adding a DB query.
- Both load automatically when you work inside those folders. When you add or change a file there, update its
  JSDoc inventory header and its entry in the matching inventory. JSDoc inventory headers apply only to
  `packages/shared/` (utils + services) and `packages/hub/src/components/`, not to feature folders.

## Build dependency

`packages/mcp-server` and `packages/hub` both compile against `packages/shared/dist/`, **not** the TypeScript source directly.

After editing anything in `packages/shared/src/`, run:

```
cd packages/shared && npm run build
```

before type-checking or running dependent packages. Without this step, downstream packages will see stale type definitions and report false errors.

## Extension points

### `trip_bookings.details` (JSONB)

This column is the designated extension point for booking-type-specific metadata. Do not add new columns to `trip_bookings` for type-specific fields — put them in `details` instead.

Conventions:

- Define a TypeScript interface in `src/types/index.ts` for each details shape.
- Always add a `readonly kind: '<type>'` discriminator field so consumers can distinguish shapes at runtime without checking `booking_type`.
- Current shapes: `FlightDetails` (`kind: 'flight'`), `TransportDetails` (`kind: 'transport'`).

### `TripBookingTypes` constant

Lives in `src/constants/travel.ts`. When adding a new booking type, also update `BookingTypeIcon.tsx` in hub and any `switch`/`case` blocks in `coming-next-utils.ts` and `BookingsSection.tsx`.
