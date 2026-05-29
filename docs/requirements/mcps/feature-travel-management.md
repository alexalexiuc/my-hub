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

| ID    | Requirement                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Users can create and manage trips containing reservations, places, checklist items, companions, and documents.                                                                                                      |
| FR-02 | Reservations support multiple booking categories in one merged model (`trip_bookings`) using `bookingType` plus `details` JSONB.                                                                                    |
| FR-03 | MCP exposes task-oriented travel tools (planning, importing reservations from text, preparing checklist, managing travel companions, generating trip brief, attaching document links).                              |
| FR-04 | MCP exposes read-only resources for quick travel context snapshots.                                                                                                                                                 |
| FR-05 | All travel data is scoped to the authenticated user.                                                                                                                                                                |
| FR-06 | Hub provides the primary full CRUD experience for detailed travel editing.                                                                                                                                          |
| FR-07 | MCP travel booking tools should capture and persist a direct reservation reference link when one is available in user-provided context.                                                                             |
| FR-08 | Day notes support linked places (placeIds array). `travel_upsert_day_note` accepts `placeIds` and guides AI to provide precise location data. `travel_get_day_notes` returns days enriched with full place details. |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Schema: travel tables are defined in `packages/shared/src/db/schema/travel.ts` with FK user scoping and indexes.                                                                                        |
| TR-02 | Services: travel domain services exist in `packages/shared/src/services/travel/` and are exported from shared service index.                                                                            |
| TR-03 | MCP server: travel sub-server is registered in `packages/mcp-server/src/server.ts` at `/api/travel/mcp` using `McpServerName.Travel`.                                                                   |
| TR-04 | MCP design follows task-oriented semantics per `.claude/skills/mcp-task-tools/SKILL.md`.                                                                                                                |
| TR-05 | `McpServerName` enum and DB enum include `travel`.                                                                                                                                                      |
| TR-06 | Hub travel page and APIs provide clear visual UX and complete CRUD controls for reservations/checklist/companions/documents.                                                                            |
| TR-07 | Document upload/linking uses server-backed storage volume with DB metadata in V1.                                                                                                                       |
| TR-08 | Travel file constraints (`TRAVEL_FILES_MAX_MB`, `TRAVEL_FILES_ALLOWED_MIME`) are parsed centrally in app config and exposed via MCP resource.                                                           |
| TR-09 | Travel booking MCP tools (`travel_add_reservation_from_text`, `travel_add_flight`, `travel_add_transport`, and edit tools) accept `reference_link` URL inputs and pass them to shared booking services. |
| TR-10 | `trip_days.place_ids integer[]` column stores place associations. Migration generated from Drizzle schema; COALESCE in conflict update preserves associations when Hub UI saves without placeIds.       |

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
