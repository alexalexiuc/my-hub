# Feature: Calorie Tracker MCP

| Field    | Value                             |
| -------- | --------------------------------- |
| Status   | implemented                       |
| Priority | high                              |
| File     | `mcps/feature-calorie-tracker.md` |

---

## Summary

The Calorie Tracker MCP server lets an AI client log meals, retrieve nutritional
summaries, manage the user's dietary profile, and track body measurements over time
on behalf of the authenticated user. Implemented as a Fastify module backed by
PostgreSQL on the self-hosted platform.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-01 | The server must expose a tool to log a meal (description, calories, macros, date, meal type).                                                    |
| FR-02 | The server must expose a tool to retrieve a daily nutritional summary (total calories, macros, meal list) for a given date.                      |
| FR-03 | The server must expose a tool to retrieve a weekly nutritional summary.                                                                          |
| FR-04 | The server must expose a tool to read and update the user's dietary profile (daily calorie goal, activity level, sex, age). Body measurements are logged separately via FR-09. |
| FR-05 | The server must expose a tool to delete a previously logged meal by `meal_id`.                                                                   |
| FR-06 | The server must expose a tool to get remaining calories for the day (goal minus logged).                                                         |
| FR-07 | All tools must be scoped to the authenticated user.                                                                                              |
| FR-08 | The server must be reachable at `POST /mcp/calories` of the shared MCP Fastify app; `userId` is resolved from the Bearer token.                  |
| FR-09 | The server must expose a tool to log a time-stamped body measurement (weight, height, neck, waist, hips, etc.) by measurement type key and value. |
| FR-10 | The server must expose a tool to retrieve body measurements with optional filtering by type, date range, and limit.                              |
| FR-11 | The server must expose a tool to list all supported measurement types (key, label, unit).                                                        |
| FR-12 | The server must expose a tool to delete a body measurement by ID.                                                                                |
| FR-13 | TDEE and BMR calculations must source height and weight from the latest body measurements, not from the profile table.                           |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Implementation lives in `packages/mcp-server/src/calories/` — `server.ts` wires tools; `tools/` contains `profile.ts`, `meals.ts`, `summary.ts`, and `measurements.ts`.                        |
| TR-02 | DB schema uses four tables: `calorie_profiles` (age, sex, activity, goal), `meal_logs`, `measurement_types` (lookup with key/label/unit), and `body_measurements` (time-series per user+type).  |
| TR-03 | Access is protected by OAuth 2.1 PKCE; `mcpAuthHandler` validates the Bearer token and attaches `userId` to the request.                                                                       |
| TR-04 | All DB queries go through `packages/shared/src/services/calories/` and `packages/shared/src/services/measurements/` — no raw Drizzle in `mcp-server`.                                          |
| TR-05 | MCP transport uses `WebStandardStreamableHTTPServerTransport` in stateless mode (new server instance per POST).                                                                                 |
| TR-06 | `measurement_types` is a lookup table pre-seeded with: `weight` (kg), `height` (cm), `neck` (cm), `waist` (cm), `hips` (cm), `chest` (cm), `bicep` (cm), `body_fat` (%). Seeded via migration. |
| TR-07 | `calories_get_profile` and TDEE-dependent summary tools must call `getLatestMeasurementsPerType(userId)` and pass the latest `height`/`weight` values to `calculateTDEE`.                       |

---

## Open Questions

- [ ] Should historical meal data older than N days be archived or kept fully queryable?
- [ ] Is barcode/food-database integration (e.g. Open Food Facts) in scope for a future iteration?

---

## Acceptance Criteria

- [x] All calorie-tracker MCP tools are registered: `calories_log_meal`, `calories_get_meals`, `calories_delete_meal`, `calories_get_daily_summary`, `calories_get_weekly_summary`, `calories_get_remaining`, `calories_get_profile`, `calories_update_profile`, `calories_log_measurement`, `calories_get_measurements`, `calories_get_measurement_types`, `calories_delete_measurement`.
- [x] A Claude client authenticated with a valid OAuth token can log a meal, retrieve the daily summary, and delete the meal.
- [x] A Claude client can log a body measurement by type key, retrieve measurements filtered by type/date, and delete a measurement.
- [x] `calories_get_profile` returns `latest_measurements` alongside the profile and calculated TDEE.
- [x] TDEE returns `null` when no height or weight measurement exists for the user.
- [x] An unauthenticated request returns 401.
- [ ] Data previously in Google Sheets is migrated to PostgreSQL (one-time migration script not yet written).
- [ ] Unit tests cover the core tool handlers.
