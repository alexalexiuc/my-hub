# hub package — Agent Guidelines

## Travel booking display: two separate paths

There are two independent rendering paths for bookings. When changing how a booking type is displayed, **both need updating**:

| File                                  | What it drives                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/travel/coming-next-utils.ts` | "Coming Next" timeline — `primaryLabel`, `secondaryLabel`, endpoint labels, navigate URLs |
| `src/app/travel/BookingsSection.tsx`  | Reservations list + add/edit form UI                                                      |

## API field naming: `flight_details` → `details` column

The booking POST/PATCH API accepts `body.flight_details` and stores it directly as the `details` JSONB column. The name is historical — it is used for all detail types (`FlightDetails`, `TransportDetails`, etc.), not just flights.

When adding support for a new details shape in the UI, pass it as `body.flight_details` in the fetch call.
