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

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The server must expose a tool to log a meal (description, calories, macros, date, meal type).                                                                                                                                                                                                                                                                           |
| FR-02 | The server must expose a tool to retrieve a daily nutritional summary (total calories, macros, meal list) for a given date.                                                                                                                                                                                                                                             |
| FR-03 | The server must expose a tool to retrieve a weekly nutritional summary.                                                                                                                                                                                                                                                                                                 |
| FR-04 | The server must expose a tool to read and update the user's dietary profile (daily calorie goal, activity level, sex, age). Body measurements are logged separately via FR-09.                                                                                                                                                                                          |
| FR-05 | The server must expose a tool to delete a previously logged meal by `meal_id`.                                                                                                                                                                                                                                                                                          |
| FR-06 | The server must expose a tool to get remaining calories for the day (goal minus logged).                                                                                                                                                                                                                                                                                |
| FR-07 | All tools must be scoped to the authenticated user.                                                                                                                                                                                                                                                                                                                     |
| FR-08 | The server must be reachable at `/api/calories/mcp` of the shared MCP Fastify app; `userId` is resolved from the Bearer token.                                                                                                                                                                                                                                          |
| FR-09 | The server must expose a tool to log a time-stamped body measurement (weight, height, neck, waist, hips, etc.) by measurement type key and value.                                                                                                                                                                                                                       |
| FR-10 | The server must expose a tool to retrieve body measurements with optional filtering by type, date range, and limit.                                                                                                                                                                                                                                                     |
| FR-11 | The server must expose a tool to list all supported measurement types (key, label, unit).                                                                                                                                                                                                                                                                               |
| FR-12 | The server must expose a tool to delete a body measurement by ID.                                                                                                                                                                                                                                                                                                       |
| FR-13 | TDEE and BMR calculations must source height and weight from the latest body measurements, not from the profile table.                                                                                                                                                                                                                                                  |
| FR-14 | The server must expose weekly-menu tools: create/replace a week's meal plan (`calories_create_weekly_menu`), retrieve menus (`calories_get_weekly_menu`), add a meal to an existing menu (`calories_add_meal`), swap one meal slot (`calories_swap_meal`), remove one meal slot (`calories_remove_menu_meal`), and delete a whole menu (`calories_delete_weekly_menu`). |
| FR-15 | A weekly menu is unique per user + `weekStart` (Monday, YYYY-MM-DD); creating a menu for an existing week replaces it. Each (dayOfWeek, mealType) slot may appear at most once per menu — duplicate slots are rejected with a clear error on both the Hub API and the MCP tool (shared `hasDuplicateMealSlot` rule).                                                    |
| FR-16 | The profile stores optional gym days (0=Mon … 6=Sun) and a gym-day calorie bonus (default 300 kcal). Per-day calorie targets and the MCP create-tool's over/under-target warnings must include the bonus on gym days. Both fields are settable from the Hub profile form and the `calories_update_profile` MCP tool.                                                    |
| FR-17 | Logging a planned menu meal as eaten must atomically write the calorie-journal entry and the slot's day-log marker (single transaction via `logMenuMeal`); re-logging an already-logged slot must not create a duplicate journal entry.                                                                                                                                 |
| FR-18 | Each menu has a persisted manual shopping list (add/check/delete items, bulk import from the auto-generated list) plus a session-only auto-generated list extracted from meal descriptions.                                                                                                                                                                             |
| FR-19 | The Hub UI exposes the feature under Calories → Weekly Menu: week navigation, per-day cards with planned-vs-target bars, meal log/swap/add/remove, adherence summary, menu creation modal, and the shopping list modal.                                                                                                                                                 |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Implementation lives in `packages/mcp-server/src/calories/` — `server.ts` wires tools; `tools/` contains `profile.ts`, `meals.ts`, `summary.ts`, and `measurements.ts`.                                                                                                                                                                |
| TR-02 | DB schema uses three tables: `calorie_profiles` (age, sex, activity, goal), `meal_logs`, and `body_measurements` (time-series per user+type). Measurement type metadata (key/label/unit) is defined in shared constants.                                                                                                               |
| TR-03 | Access is protected by OAuth 2.1 PKCE; `mcpAuthHandler` validates the Bearer token and attaches `userId` to the request.                                                                                                                                                                                                               |
| TR-04 | All DB queries go through `packages/shared/src/services/calories/` and `packages/shared/src/services/measurements/` — no raw Drizzle in `mcp-server`.                                                                                                                                                                                  |
| TR-05 | MCP transport uses `WebStandardStreamableHTTPServerTransport` in stateless mode (new server instance per POST).                                                                                                                                                                                                                        |
| TR-06 | Measurement types are defined in `packages/shared/src/constants/measurements.ts` as a constant list of `{ key, label, unit }` objects (e.g. `weight`/kg, `height`/cm, `body_fat`/%), consumed by Hub and MCP services.                                                                                                                 |
| TR-07 | `calories_get_profile` and TDEE-dependent summary tools must call `getLatestMeasurementsPerType(userId)` and pass the latest `height`/`weight` values to `calculateTDEE`.                                                                                                                                                              |
| TR-08 | Date defaults for calorie daily/history flows must use the authenticated user's stored timezone when available (falling back to server-local behavior only when timezone is unset/invalid).                                                                                                                                            |
| TR-09 | Weekly-menu storage uses four tables: `weekly_menus` (user + week_start), `weekly_menu_meals` (unique slot constraint `uq_weekly_menu_meal_slot`), `weekly_menu_day_logs` (logged-slot markers, unique per slot), and `weekly_menu_shopping_items` (unique per menu + text). Child tables cascade on menu delete.                      |
| TR-10 | All weekly-menu queries live in `packages/shared/src/services/calories/weekly-menu.ts` and `shopping-list.ts`. Menu ownership checks go through `hasAccessToMenu` (1s promise cache); every code path that deletes a menu (delete, replace-on-create, delete-all) must evict the cache entry to avoid FK violations from stale grants. |
| TR-11 | Hub route contracts for the feature are Zod schemas in `packages/hub/src/app/api/calories/menu/menu.schemas.ts`, shared by the routes (`route({ body, response })`) and the client (`apiFetch` `bodySchema`/`responseSchema`). The duplicate-slot rule is `hasDuplicateMealSlot` from `@my-hub/shared/utils`.                          |

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
- [x] All weekly-menu MCP tools are registered: `calories_create_weekly_menu`, `calories_get_weekly_menu`, `calories_add_meal`, `calories_swap_meal`, `calories_remove_menu_meal`, `calories_delete_weekly_menu`.
- [x] Creating a menu with a duplicate (dayOfWeek, mealType) slot is rejected with a clear error on both the Hub API and the MCP tool.
- [x] Create-tool calorie warnings account for the gym-day bonus, and `calories_update_profile` can set both `gymDays` and `gymDayCalorieBonus`.
- [x] Logging a planned meal writes the journal entry and the day-log marker atomically; retrying a logged slot does not duplicate the journal entry.
- [x] The Hub Weekly Menu page covers create/navigate/log/swap/add/remove/delete plus the shopping list (Playwright journey in `packages/e2e/tests/calories-weekly-menu.spec.ts`).
- [ ] Data previously in Google Sheets is migrated to PostgreSQL (one-time migration script not yet written).
- [ ] Unit tests cover the core tool handlers.
