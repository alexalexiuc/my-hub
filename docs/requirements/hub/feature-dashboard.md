# Feature: Dashboards

| Field    | Value                      |
| -------- | -------------------------- |
| Status   | implemented                |
| Priority | high                       |
| File     | `hub/feature-dashboard.md` |

---

## Summary

The Hub has two dashboards: the **main dashboard** at `/` (homepage overview with
quick stats and navigation) and the **Calories dashboard** at `/calories` (full
calorie tracking UI with profile, meals, and body measurements). The legacy `/dashboard`
route redirects to `/calories`.

---

## Main Dashboard (`/`)

### Functional Requirements

| ID    | Requirement                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| FR-01 | The main dashboard must display the user's display name as a greeting when a name is set.                                |
| FR-02 | The main dashboard must display quick stats: today's total kcal, the daily calorie target, and the latest logged weight. |
| FR-03 | The main dashboard must display app tiles linking to each feature dashboard (currently: Calories).                       |
| FR-04 | The main dashboard must display admin links: OAuth Clients, MCP Control, Data Explorer.                                  |
| FR-05 | The main dashboard must display a link to the Profile page.                                                              |
| FR-06 | Quick stats are fetched client-side on load and rendered when available; the page must not block on slow data fetches.   |

### Technical Requirements

| ID    | Requirement                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| TR-01 | The page is a client component (`"use client"`) at `packages/hub/src/app/page.tsx`.                                                  |
| TR-02 | Quick stats are derived from `GET /api/calories/profile` (profile + latest measurements) and `GET /api/calories/meals?date=<today>`. |
| TR-03 | TDEE calculation is done client-side using the same Mifflin-St Jeor formula as the server.                                           |

---

## Calories Dashboard (`/calories`)

### Functional Requirements

| ID    | Requirement                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| FR-07 | The Calories dashboard must display the user's calorie profile (age, sex, activity, height, weight, daily target).    |
| FR-08 | The user must be able to edit the calorie profile inline without leaving the page.                                    |
| FR-09 | The Calories dashboard must display today's logged meals grouped by meal type, with per-meal macros and a kcal total. |
| FR-10 | The user must be able to add a meal from the Calories dashboard (description, type, date, kcal, macros, notes).       |
| FR-11 | The user must be able to delete a meal from the Calories dashboard.                                                   |
| FR-12 | The Calories dashboard must display the latest body measurement for each recorded type in a summary grid.             |
| FR-13 | The user must be able to log a new body measurement from the Calories dashboard (type, value, date, notes).           |
| FR-14 | The user must be able to delete a body measurement entry from the Calories dashboard.                                 |
| FR-15 | All data on the Calories dashboard must refresh after any add/delete action without a full page reload.               |

### Technical Requirements

| ID    | Requirement                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-04 | The page is a client component at `packages/hub/src/app/calories/page.tsx`.                                                                           |
| TR-05 | Components are split into three files: `profile-card.tsx`, `meals-section.tsx`, `measurements-section.tsx` — all in `packages/hub/src/app/calories/`. |
| TR-06 | All mutations (add/delete meal, add/delete measurement, update profile) go through the calories API routes under `/api/calories/`.                    |
| TR-07 | All components use shared UI primitives from `packages/hub/src/components/`: `PageHeader`, `SectionCard`, `Field`, `Button`.                          |
| TR-08 | The `/dashboard` route permanently redirects to `/calories` via Next.js `redirect()`.                                                                 |

---

## API Routes

| Method | Path                                  | Description                                   |
| ------ | ------------------------------------- | --------------------------------------------- |
| GET    | `/api/calories/profile`               | Returns calorie profile + latest measurements |
| PUT    | `/api/calories/profile`               | Updates calorie profile fields                |
| GET    | `/api/calories/meals?date=&mealType=` | Returns meal logs with optional filters       |
| POST   | `/api/calories/meals`                 | Logs a new meal                               |
| DELETE | `/api/calories/meals/[mealId]`        | Deletes a meal by `meal_id`                   |
| GET    | `/api/calories/measurements?type=`    | Returns body measurements with filters        |
| POST   | `/api/calories/measurements`          | Logs a new body measurement                   |
| DELETE | `/api/calories/measurements/[id]`     | Deletes a body measurement by ID              |
| GET    | `/api/calories/measurement-types`     | Returns all available measurement types       |

---

## Open Questions

- [ ] Should the Calories dashboard show a calorie progress bar (consumed vs. target)?
- [ ] Should past dates be browsable on the Calories dashboard (date picker for meals)?
- [ ] Should body measurement history be visualised with a chart (weight over time, etc.)?

---

## Acceptance Criteria

- [x] The main dashboard loads and shows today's kcal, daily target, and latest weight when data exists.
- [x] The main dashboard shows the app tile for Calories and admin links.
- [x] The Calories dashboard shows the calorie profile; the edit form saves and reflects immediately.
- [x] Adding a meal via the form persists it and shows it in the list without a page reload.
- [x] Deleting a meal removes it from the list immediately.
- [x] Logging a body measurement persists it and updates the measurements grid.
- [x] Deleting a body measurement removes it from the grid.
- [x] Navigating to `/dashboard` redirects to `/calories`.
