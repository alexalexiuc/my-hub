# Feature: Travel Management

| Field    | Value                               |
| -------- | ----------------------------------- |
| Status   | in-progress                         |
| Priority | high                                |
| File     | `mcps/feature-travel-management.md` |

---

## Summary

Travel Management adds a Google Trips-inspired domain where users can organize trips, reservations, companions, checklist items, places, and documents. The MCP layer is intentionally task-oriented for AI workflows, while detailed CRUD is primarily handled in Hub UI and internal APIs.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Users can create and manage trips containing reservations, places, checklist items, companions, and documents.                                                                                                                                                                                           |
| FR-02 | Reservations support multiple booking categories in one merged model (`trip_bookings`) using `bookingType` plus `details` JSONB.                                                                                                                                                                         |
| FR-03 | MCP exposes task-oriented travel tools (planning, importing reservations from text, preparing checklist, managing travel companions, generating trip brief, attaching document links).                                                                                                                   |
| FR-04 | MCP exposes read-only resources for quick travel context snapshots.                                                                                                                                                                                                                                      |
| FR-05 | All travel data is scoped to the authenticated user.                                                                                                                                                                                                                                                     |
| FR-06 | Hub provides the primary full CRUD experience for detailed travel editing.                                                                                                                                                                                                                               |
| FR-07 | MCP travel booking tools should capture and persist a direct reservation reference link when one is available in user-provided context.                                                                                                                                                                  |
| FR-08 | Day notes support linked places (placeIds array). `travel_upsert_day_note` accepts `placeIds` and guides AI to provide precise location data. `travel_get_day_notes` returns days enriched with full place details.                                                                                      |
| FR-09 | A trip without its own start/end date inherits them from its bookings (earliest booking start, latest booking end), as the Hub shows it. The "next trip" lookup (`travel_get_trip_brief` without `tripId`, the `upcoming` resource) uses these dates, and the brief marks them with `datesFromBookings`. |
| FR-10 | `travel_list_trips` lists owned and shared trips (id, name, destination, dates — inherited from bookings when missing — status, booking count, access role) with `status` and `from`/`to` overlap filters.                                                                                               |
| FR-11 | `travel_update_trip` changes an existing trip's name, destination, dates, notes or colour and cancels/reinstates it (`cancelled` sets/clears `cancelledAt`); an end before the start is rejected. `travel_delete_trip` permanently deletes a trip with all its data.                                     |
| FR-12 | `travel_edit_booking` also updates `costAmount`/`costCurrency`, deep-merges a partial `details` patch (null removes a key, the stored `kind` is kept) and moves a booking to another owned trip via `tripId`.                                                                                            |
| FR-13 | `travel_manage_checklist` adds, renames, checks off/un-checks and removes checklist items in one call.                                                                                                                                                                                                   |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Schema: travel tables are defined in `packages/shared/src/db/schema/travel.ts` with FK user scoping and indexes.                                                                                                                                                                                |
| TR-02 | Services: travel domain services exist in `packages/shared/src/services/travel/` and are exported from shared service index.                                                                                                                                                                    |
| TR-03 | MCP server: travel sub-server is registered in `packages/mcp-server/src/server.ts` at `/api/travel/mcp` using `McpServerName.Travel`.                                                                                                                                                           |
| TR-04 | MCP design follows task-oriented semantics per `.claude/skills/mcp-tool/SKILL.md`.                                                                                                                                                                                                              |
| TR-05 | `McpServerName` enum and DB enum include `travel`.                                                                                                                                                                                                                                              |
| TR-06 | Hub travel page and APIs provide clear visual UX and complete CRUD controls for reservations/checklist/companions/documents.                                                                                                                                                                    |
| TR-07 | Document upload/linking uses server-backed storage volume with DB metadata in V1.                                                                                                                                                                                                               |
| TR-08 | Travel file constraints (`TRAVEL_FILES_MAX_MB`, `TRAVEL_FILES_ALLOWED_MIME`) are parsed centrally in app config and exposed via MCP resource.                                                                                                                                                   |
| TR-09 | Travel booking MCP tools (`travel_add_reservation_from_text`, `travel_add_flight`, `travel_add_transport`, and edit tools) accept `reference_link` URL inputs and pass them to shared booking services.                                                                                         |
| TR-10 | `trip_days.place_ids integer[]` column stores place associations. Migration generated from Drizzle schema; COALESCE in conflict update preserves associations when Hub UI saves without placeIds.                                                                                               |
| TR-11 | Shared services: `listTripSummaries` and `updateTripDetails` (`trips.ts`, `TripInputError`), booking-range queries return `Date`s plus `bookingCount`, `updateTripBooking` accepts `tripId` (ownership checked); utils `deepMergePatch` (`objects.ts`) and `mergeBookingDetails` (`travel.ts`). |

---

## Open Questions

- [ ] Should place entries remain strictly trip-scoped in V1, or support reusable global saved places in V2?
- [ ] Should companion entries support optional linkage to registered Hub accounts in V2?
- [ ] Which MIME types and max file size should be enabled in production for document uploads?

---

## Acceptance Criteria

- [x] Travel schema added and exported in shared package.
- [x] Shared travel services added and exported.
- [x] Travel server name added to MCP server enum.
- [x] Migration generated for travel tables.
- [x] MCP travel sub-server registered at `/api/travel/mcp`.
- [x] MCP travel task-oriented tools implemented.
- [x] MCP travel resources implemented.
- [x] MCP exposes travel upload policy resource derived from centralized file config.
- [x] MCP travel booking tools capture optional reservation reference links when available.
- [x] Hub `/travel` polished UI implemented.
- [x] Server file upload API + storage volume wiring implemented.
- [x] Day notes linked to places via placeIds; MCP guides AI to use precise locations; Hub renders place chips with map links.
- [ ] E2E coverage for travel flows implemented.
- [x] MCP can list trips with filters, update/cancel/delete a trip, edit booking cost/details or move a booking, and manage checklist items (`packages/mcp-server/e2e/travel.e2e.ts` "trip management").
