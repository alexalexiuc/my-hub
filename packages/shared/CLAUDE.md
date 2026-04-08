# shared package — Agent Guidelines

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
