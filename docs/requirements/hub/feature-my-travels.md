# Feature: My Travels Hub UI

| Field    | Value                       |
| -------- | --------------------------- |
| Status   | implemented                 |
| Priority | high                        |
| File     | `hub/feature-my-travels.md` |

---

## Summary

The My Travels page provides a clear, visual travel organizer in Hub where users can create trips and manage reservations, checklist items, companions, and documents in one screen. It complements the travel MCP server by offering full CRUD-focused interactions for day-to-day editing.

---

## Functional Requirements

| ID    | Requirement                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------- |
| FR-01 | Users can create, edit, remove, and select trips from Hub to manage an active trip.                             |
| FR-02 | Users can add, edit, and remove reservations in a trip with booking type and provider/date metadata.            |
| FR-03 | Users can add, complete, edit, and remove checklist items for a trip.                                           |
| FR-04 | Users can add, edit, and remove travel companions with optional contact details.                                |
| FR-05 | Users can upload documents to server storage and download/remove them later.                                    |
| FR-06 | Users can view trip overview counts (reservations/checklist/companions/places/documents).                       |
| FR-07 | Users can view a calendar that highlights reservation date ranges (start-to-end) derived from trip bookings.    |
| FR-08 | Users can view a reservation-based from-to date range directly on each trip card.                               |
| FR-09 | Users can assign a color to each trip and use it consistently in trip cards and calendar reservation rendering. |
| FR-10 | Users can set custom trip-level from/to dates when creating or editing a trip.                                  |
| FR-11 | Users can link uploaded documents to a reservation and see attachment indicators on reservation rows.           |
| FR-12 | Users can share trips with other Hub users as view-only collaborators.                                          |
| FR-13 | The sharing UI should suggest users based on companion emails that match existing Hub accounts.                 |
| FR-14 | Trip cards should display owner identity so shared-view users can distinguish ownership.                        |

---

## Technical Requirements

| ID    | Requirement                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Travel page is implemented at `packages/hub/src/app/travel/page.tsx` as a client page with responsive layout.                         |
| TR-02 | Hub API routes under `packages/hub/src/app/api/travel/**` use `withAuth` and shared travel services.                                  |
| TR-03 | Upload/download handlers run with `runtime = 'nodejs'` and use `TRAVEL_FILES_ROOT`.                                                   |
| TR-04 | File metadata is stored in `trip_documents`; file bytes are persisted on mounted server storage.                                      |
| TR-05 | Docker compose files mount persistent travel document storage path for Hub and MCP containers.                                        |
| TR-06 | Calendar UI derives events from booking start-to-end ranges and renders monthly day cells with booking summaries.                     |
| TR-07 | Inline row actions use compact icon buttons for edit/remove/download with accessible labels.                                          |
| TR-08 | Trips API returns reservation date-range aggregates per trip and trip cards render those from-to dates.                               |
| TR-09 | Trips persist a `color` field; new trips default to a random palette color, and the create form exposes a simple native color picker. |
| TR-10 | Trip cards provide inline edit/remove actions; trip updates/deletes are handled by `PATCH/DELETE /api/travel/trips/[id]`.             |
| TR-11 | Trip create/edit forms expose date inputs and persist them via `start_at`/`end_at` in trip POST/PATCH APIs.                           |
| TR-12 | `trip_documents` supports optional `booking_id` linkage and reservation rows render attachment icons with hover details.              |
| TR-13 | Trip share records are persisted and scoped to owner-managed, view-only access (`trip_shares`).                                       |
| TR-14 | Shared users can view trip overviews and document downloads, while mutating actions remain owner-only in Hub UI.                      |

---

## Open Questions

- [ ] Should uploaded documents support in-browser preview for PDF/images in V2?
- [ ] Should travel timeline include drag-and-drop ordering for itinerary edits?
- [ ] Should companion management support role tags (organizer/adult/child) in V2?

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
