# Feature: Calories Email Reports

| Field    | Value                          |
| -------- | ------------------------------ |
| Status   | implemented                    |
| Priority | medium                         |
| File     | `hub/feature-email-reports.md` |

---

## Summary

Weekly and monthly calorie summary emails are sent automatically via AWS SES to all users who have not opted out. Each email contains calorie summaries, macro breakdowns, an inline SVG weight chart, and body measurements for the period. Users control their subscriptions from the Profile page.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-01 | A weekly report email is sent every Monday at 08:00 (UTC), covering the previous Mon–Sun week.                                                                                                                                                                                                   |
| FR-02 | A monthly report email is sent on the 1st of each month at 08:00 (UTC), covering the prior calendar month.                                                                                                                                                                                       |
| FR-03 | If a user logged zero meals in the reporting period, no email is sent for that period/user.                                                                                                                                                                                                      |
| FR-04 | The weekly report contains: header with date range, week number, and on-track/over verdict; 3 summary stat cards; daily calorie bar chart (Mon–Sun) with goal line; macro split (carbs/protein/fat); weight sparkline SVG (only if ≥ 2 measurements); body measurements grid; next-week outlook. |
| FR-05 | The monthly report contains: header with month/year and verdict; 3 summary stat cards; week-by-week calorie breakdown; macro averages; weight trend chart SVG; body composition progress table (start vs end); calorie consistency (days logged, longest streak); monthly outlook.               |
| FR-06 | The Profile page has a Notifications section with a "Calories" sub-section containing two checkboxes: "Weekly Report" and "Monthly Report".                                                                                                                                                      |
| FR-07 | Users are subscribed to both reports by default (opt-out model). Unchecking a box persists the preference immediately.                                                                                                                                                                           |
| FR-08 | A POST `/api/calories/reports/weekly-trigger` endpoint allows the authenticated user to manually trigger their own weekly report email (for testing).                                                                                                                                            |
| FR-09 | A POST `/api/calories/reports/monthly-trigger` endpoint allows the authenticated user to manually trigger their own monthly report email (for testing).                                                                                                                                          |
| FR-10 | Manual trigger endpoints return `{ sent: true }` if the email was sent, or `{ skipped: "no_data" }` if no meals were logged in the period.                                                                                                                                                       |
| FR-11 | Emails use a dark-theme HTML design with inline CSS (via `juice`), compatible with Gmail and Outlook.                                                                                                                                                                                            |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TR-01 | Emails are sent via AWS SES using `@aws-sdk/client-ses`. Credentials come from `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` env vars; sender from `SES_FROM_EMAIL`.                                                    |
| TR-02 | CSS is inlined before sending using the `juice` npm package. Both packages are dependencies of `@my-hub/shared`.                                                                                                                     |
| TR-03 | Notification subscription preferences are stored in the `notification_preferences` table: `(id, user_id, subscription_key text, subscribed boolean, updated_at)` with a unique index on `(user_id, subscription_key)`.               |
| TR-04 | `NOTIFICATION_SUBSCRIPTIONS` in `packages/shared/src/services/notifications/config.ts` is the single source of truth for subscription keys, labels, and section groupings. Never use PG enums for subscription keys.                 |
| TR-05 | A user is considered subscribed if no row exists for their `(userId, subscriptionKey)` pair, or if the existing row has `subscribed = true`.                                                                                         |
| TR-06 | `getSubscribedUserIds(subscriptionKey)` in `packages/shared/src/services/notifications/notifications.ts` returns all active user IDs who have not explicitly unsubscribed.                                                           |
| TR-07 | Email HTML is built by TypeScript template functions (no template engine): `buildWeeklyReportHtml(data: WeeklyReportData)` and `buildMonthlyReportHtml(data: MonthlyReportData)` in `packages/shared/src/services/email/templates/`. |
| TR-08 | Worker cron schedules: weekly reports `0 8 * * 1` (Monday 08:00), monthly reports `0 8 1 * *` (1st of month 08:00). Both run in `packages/worker/src/poll.ts`.                                                                       |
| TR-09 | BMR and TDEE are calculated using `calculateBMR` and `calculateCalorieTargets` from `packages/shared/src/utils/calories.ts` (Mifflin-St Jeor).                                                                                       |
| TR-10 | All kcal values use `toLocaleString('en-US')` for thousands separators. Signed deltas use the proper minus sign U+2212 (`−`), not a hyphen.                                                                                          |
| TR-11 | The weight sparkline SVG is only rendered if ≥ 2 weight measurements exist in the period; otherwise a plain text note is shown.                                                                                                      |
| TR-12 | Hub API routes for notification preferences: `GET /api/user/notification-preferences` returns subscription states; `PUT /api/user/notification-preferences` upserts a single key.                                                    |

---

## Open Questions

- [x] Should reports be sent in the user's local timezone or UTC? → UTC for simplicity (cron fires at UTC 08:00).

---

## Acceptance Criteria

- [x] Weekly email arrives every Monday with correct date range and week number.
- [x] Monthly email arrives on the 1st with correct month label.
- [x] No email is sent when zero meals were logged in the period.
- [x] Verdict badge shows "On track" (green) when average daily intake ≤ goal, "Over" (red) otherwise.
- [x] Daily bar chart shows 7 bars with goal line; bars are colour-coded by delta.
- [x] Weight sparkline renders when ≥ 2 measurements exist; falls back to text note otherwise.
- [x] Profile → Notifications section shows "Calories" group with two checkboxes.
- [x] Unchecking a report type prevents that email from being sent in subsequent runs.
- [x] `POST /api/calories/reports/weekly-trigger` sends email to authenticated user and returns `{ sent: true }`.
- [x] `POST /api/calories/reports/monthly-trigger` returns `{ skipped: "no_data" }` for a user with no meal logs.
