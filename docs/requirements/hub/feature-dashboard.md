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

| ID    | Requirement                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The main dashboard must display the user's display name as a greeting in the header when a name is set.                         |
| FR-02 | The main dashboard must display an interactive **Todo widget** showing open todos with inline add and mark-done functionality.   |
| FR-03 | The main dashboard must display an interactive **Calories widget** with a circular progress ring, macros, and quick meal add.   |
| FR-04 | The main dashboard must display app tiles linking to each feature dashboard (Calories, Todo).                                   |
| FR-05 | The main dashboard must display a Setup section with a link to MCP Control.                                                     |
| FR-06 | The main dashboard header must include a Profile icon link and a Sign-out button.                                               |
| FR-07 | The main dashboard must display a footer with links to Terms of Use, Privacy Policy, and Contact Us.                            |
| FR-08 | While data is loading, a skeleton placeholder must be shown instead of partially rendered content.                               |

### Technical Requirements

| ID    | Requirement                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| TR-01 | The page is a client component (`"use client"`) at `packages/hub/src/app/page.tsx`.                                                  |
| TR-02 | Data is fetched in parallel: `GET /api/calories/profile`, `GET /api/calories/meals?date=<today>`, and `GET /api/todo`.               |
| TR-03 | TDEE calculation is done client-side using the same Mifflin-St Jeor formula as the server.                                           |
| TR-04 | Dashboard header, footer, todo widget, calories widget, and circular progress are in `packages/hub/src/components/dashboard/`.       |

---

## Calories Dashboard (`/calories`)

### Functional Requirements

| ID    | Requirement                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| FR-07 | The Calories dashboard must display the user's calorie profile (age, sex, activity, height, weight, daily target).    |
| FR-08 | The user must be able to edit the calorie profile inline without leaving the page.                                    |
| FR-09 | The Calories dashboard must display meals grouped by meal type with per-meal macros, kcal total, and a totals summary row. |
| FR-10 | The user must be able to add a meal from the Calories dashboard (description, type, date, kcal, macros, notes).            |
| FR-11 | The user must be able to delete a meal from the Calories dashboard.                                                        |
| FR-16 | The user must be able to edit an existing meal inline (click to expand edit form with all fields).                          |
| FR-17 | The meals section must support date navigation (prev/next arrows) to browse meals from past dates.                         |
| FR-18 | The meals section must show a slim progress bar indicating consumed vs target calories.                                    |
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
| PATCH  | `/api/calories/meals/[mealId]`        | Updates a meal's fields                       |
| DELETE | `/api/calories/meals/[mealId]`        | Deletes a meal by `meal_id`                   |
| GET    | `/api/calories/measurements?type=`    | Returns body measurements with filters        |
| POST   | `/api/calories/measurements`          | Logs a new body measurement                   |
| DELETE | `/api/calories/measurements/[id]`     | Deletes a body measurement by ID              |
| GET    | `/api/calories/measurement-types`     | Returns all available measurement types       |

---

## Open Questions

- [x] ~~Should the Calories dashboard show a calorie progress bar (consumed vs. target)?~~ Yes — slim inline bar in meals section.
- [x] ~~Should past dates be browsable on the Calories dashboard (date picker for meals)?~~ Yes — prev/next arrows with date navigation.
- [ ] Should body measurement history be visualised with a chart (weight over time, etc.)?

---

## Acceptance Criteria

- [x] The main dashboard shows a header with user greeting, profile icon, and sign-out button.
- [x] The main dashboard shows interactive Todo and Calories widgets with real-time add/complete actions.
- [x] The main dashboard shows app tiles for Calories and Todo, and a Setup link to MCP Control.
- [x] The main dashboard shows a footer with Terms, Privacy, and Contact links.
- [x] A skeleton loading state is shown until data is fetched.
- [x] The Calories dashboard shows the calorie profile; the edit form saves and reflects immediately.
- [x] Adding a meal via the form persists it and shows it in the list without a page reload.
- [x] Editing a meal inline updates it immediately.
- [x] Deleting a meal removes it from the list immediately.
- [x] Date navigation (prev/next) loads meals for the selected date.
- [x] A slim progress bar shows consumed vs target calories.
- [x] Logging a body measurement persists it and updates the measurements grid.
- [x] Deleting a body measurement removes it from the grid.
- [x] Navigating to `/dashboard` redirects to `/calories`.
