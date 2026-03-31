# Feature: My Travels Hub UI

| Field    | Value                       |
| -------- | --------------------------- |
| Status   | in-progress                 |
| Priority | high                        |
| File     | `hub/feature-my-travels.md` |

---

## Summary

The My Travels page provides a clear, visual travel organizer in Hub where users can create trips and manage reservations, checklist items, companions, and documents in one screen. It complements the travel MCP server by offering full CRUD-focused interactions for day-to-day editing.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Users can create, edit, remove, and select trips from Hub to manage an active trip.                                                                                              |
| FR-02 | Users can add, edit, and remove reservations in a trip with booking type and provider/date metadata.                                                                             |
| FR-03 | Users can add, complete, edit, and remove checklist items for a trip.                                                                                                            |
| FR-04 | Users can add, edit, and remove travel companions with optional contact details.                                                                                                 |
| FR-05 | Users can upload documents to server storage and download/remove them later.                                                                                                     |
| FR-06 | Users can view trip overview counts (reservations/checklist/companions/places/documents).                                                                                        |
| FR-07 | Users can view a calendar that highlights reservation date ranges (start-to-end) derived from trip bookings.                                                                     |
| FR-08 | Users can view a reservation-based from-to date range directly on each trip card.                                                                                                |
| FR-09 | Users can assign a color to each trip and use it consistently in trip cards and calendar reservation rendering.                                                                  |
| FR-10 | Users can set custom trip-level from/to dates when creating or editing a trip.                                                                                                   |
| FR-11 | Users can link uploaded documents to a reservation and see attachment indicators on reservation rows.                                                                            |
| FR-12 | Users can share trips with other Hub users as view-only collaborators.                                                                                                           |
| FR-13 | The sharing UI should suggest users based on companion emails that match existing Hub accounts.                                                                                  |
| FR-14 | Trip cards should display owner identity so shared-view users can distinguish ownership.                                                                                         |
| FR-15 | Flight bookings show a structured info line: flight number, route (origin → destination), seat, terminal, gate, and live status.                                                 |
| FR-16 | Flight bookings show a live/paused badge that the user can click to toggle automatic flight data updates.                                                                        |
| FR-17 | The booking edit form exposes flight-specific fields (flight number, seat, origin IATA, destination IATA, terminal, gate, aircraft type) only when the booking type is `flight`. |
| FR-18 | Coming Next chips are color-coded by time proximity: past (dimmed, dashed border), active (sky blue), imminent <1h (red), soon <24h (amber), future (neutral zinc). |
| FR-19 | Past Coming Next chips collapse to a compact row (icon + date/time + label + "Done" badge) and can be expanded by clicking. |
| FR-20 | Past chip time display includes both date and time (e.g. "31 Mar · 08:30") so the user can clearly see when the segment occurred. |
| FR-21 | Reservation rows are expandable on click, revealing location, confirmation number, cost, status, notes, and attachments. |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Travel page is implemented at `packages/hub/src/app/travel/page.tsx` as a client page with responsive layout.                                                                                                                                                                                       |
| TR-02 | Hub API routes under `packages/hub/src/app/api/travel/**` use `withAuth` and shared travel services.                                                                                                                                                                                                |
| TR-03 | Upload/download handlers run with `runtime = 'nodejs'` and use `TRAVEL_FILES_ROOT`.                                                                                                                                                                                                                 |
| TR-04 | File metadata is stored in `trip_documents`; file bytes are persisted on mounted server storage.                                                                                                                                                                                                    |
| TR-05 | Docker compose files mount persistent travel document storage path for Hub and MCP containers.                                                                                                                                                                                                      |
| TR-06 | Calendar UI derives events from booking start-to-end ranges and renders monthly day cells with booking summaries.                                                                                                                                                                                   |
| TR-07 | Inline row actions use compact icon buttons for edit/remove/download with accessible labels.                                                                                                                                                                                                        |
| TR-08 | Trips API returns reservation date-range aggregates per trip and trip cards render those from-to dates.                                                                                                                                                                                             |
| TR-09 | Trips persist a `color` field; new trips default to a random palette color, and the create form exposes a simple native color picker.                                                                                                                                                               |
| TR-10 | Trip cards provide inline edit/remove actions; trip updates/deletes are handled by `PATCH/DELETE /api/travel/trips/[id]`.                                                                                                                                                                           |
| TR-11 | Trip create/edit forms expose date inputs and persist them via `start_at`/`end_at` in trip POST/PATCH APIs.                                                                                                                                                                                         |
| TR-12 | `trip_documents` supports optional `booking_id` linkage and reservation rows render attachment icons with hover details.                                                                                                                                                                            |
| TR-13 | Trip share records are persisted and scoped to owner-managed, view-only access (`trip_shares`).                                                                                                                                                                                                     |
| TR-14 | Shared users can view trip overviews and document downloads, while mutating actions remain owner-only in Hub UI.                                                                                                                                                                                    |
| TR-15 | A `flight_data` table stores one row per unique flight-number + date: IATA codes, terminal, gate, scheduled/actual times, status, aircraft, airline, and `raw_response` JSONB. `trip_bookings` gains a nullable `flight_data_id` FK so multiple bookings on the same physical flight share one row. |
| TR-16 | `trip_bookings` retains a `details` JSONB column (`FlightDetails` type) for user/AI-provided fallback values (seat, gate, terminal, aircraft type).                                                                                                                                                 |
| TR-17 | `packages/worker` runs a 60-second poll loop: calls `getFlightDataDueForFetch()` and updates rows via shared `flightData.ts` services. Runs DB migrations on container startup before the loop begins.                                                                                              |
| TR-18 | `computeNextFetchAt()` in `packages/shared/src/services/travel/flightData.ts` schedules next poll by departure proximity: ≤3 h → 15 min, ≤72 h → 1 h, ≤168 h → 6 h, ≤720 h → 24 h, >30 days → 7 days. Finished flights are not re-polled.                                                           |
| TR-19 | Live flight data is fetched from AeroDataBox via RapidAPI (`RAPIDAPI_KEY` env var). Client lives in `packages/shared/src/services/travel/flightDataApi.ts`.                                                                                                                                         |
| TR-20 | `PATCH /api/travel/flight-data/[id]` toggles `auto_update_enabled` on a `flight_data` row.                                                                                                                                                                                                          |
| TR-21 | The trip overview API joins `flight_data` rows into booking responses so the UI receives live data without extra round-trips.                                                                                                                                                                       |
| TR-22 | The MCP `travel_add_reservation_from_text` tool extracts flight fields (flight number, seat, origin/destination IATA, terminal, gate, aircraft type) from booking text and automatically upserts a `flight_data` row linked to the booking.                                                         |
| TR-23 | `coming-next-utils.ts` computes `timeBucket` (`past \| now \| imminent \| soon \| future`) and `isPast` per segment; `formatSegmentTime` returns date+time string (e.g. "31 Mar · 08:30") for past segments. |
| TR-24 | `SegmentCard` renders collapsed compact chip for past segments (clickable button with "Done" badge); click expands to full card. Imminent segments display a pulsing "Soon!" badge. Color theme: past=dimmed dashed, now=sky, imminent=red, soon=amber, future=zinc. |
| TR-25 | `BookingsSection` reservation rows are expandable via click; expanded panel shows location, confirmationNumber, cost, status, notes, and linked attachments inline. |
| TR-26 | `BookingsSection` flight form includes a seat field (`seat` stored in `details` JSONB) in both add and edit modes. |

---

## Open Questions

- [ ] Should uploaded documents support in-browser preview for PDF/images in V2?
- [ ] Should travel timeline include drag-and-drop ordering for itinerary edits?
- [ ] Should companion management support role tags (organizer/adult/child) in V2?
- [ ] **TODO**: Enhance location details for better navigation results. Update MCP server with more accurate location requests from AI models — e.g. provide full address or GPS coordinates instead of free-text location strings so the Navigate action opens the correct map pin.

---

## Acceptance Criteria

- [x] `/travel` page exists and is accessible from dashboard app cards.
- [x] Hub can create trips and load trip overview.
- [x] Hub can edit and remove trips from the trip card list.
- [x] Hub can add reservations/checklist items/companions.
- [x] Hub can edit reservations and checklist items inline.
- [x] Hub can edit companions inline.
- [x] Hub can remove reservations and checklist items.
- [x] Hub can upload and download travel documents.
- [x] Hub can remove companions and documents.
- [x] Hub shows a monthly calendar populated from trip booking dates.
- [x] Hub trip cards show reservation-based from-to dates.
- [x] Hub supports trip color coding and calendar events reflect the active trip color.
- [x] Hub supports custom trip-level from/to dates in create/edit flows.
- [x] Hub supports linking documents to reservations and shows reservation attachment indicators.
- [x] Hub supports view-only trip sharing with owner-managed shares.
- [x] Hub suggests share targets from companion emails that match existing Hub users.
- [x] Hub trip cards display owner identity for shared trips.
- [x] E2E test coverage added for core `/travel` interactions.
- [x] Flight bookings render a structured info line (number, route, seat, terminal, gate, status).
- [x] Flight bookings show a live/paused badge toggling `auto_update_enabled`.
- [x] Booking edit form shows flight-specific fields only when type is `flight`.
- [x] Worker polls `flight_data` rows on a 60-second interval and updates live fields.
- [x] MCP reservation import extracts flight metadata and links a `flight_data` row.
- [x] Coming Next chips show date+time for past segments (not just hour).
- [x] Coming Next chips are color-coded by time proximity (past/active/imminent/soon/future).
- [x] Past chips collapse to compact row by default; click to expand full card.
- [x] Reservation rows expand on click to reveal full details (location, cost, notes, attachments).
- [x] Flight booking form includes seat field in add and edit modes.
