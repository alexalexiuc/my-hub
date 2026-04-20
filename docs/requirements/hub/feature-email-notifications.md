# Feature: Email Notifications

| Field    | Value                                |
| -------- | ------------------------------------ |
| Status   | implemented                          |
| Priority | medium                               |
| File     | `hub/feature-email-notifications.md` |

---

## Summary

The hub has an email notification system that allows users to opt out of specific notification types. Notifications are sent via AWS SES. Users manage their subscriptions from the Profile page. Each notification type is an independent, opt-out feature — users are subscribed by default and can unsubscribe per type.

The first two notifications built on this system are the weekly and monthly calorie summary emails.

---

## Notification System

### Functional Requirements

| ID    | Requirement                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The Profile page has a Notifications section, grouping notification checkboxes by feature (e.g. "Calories").                                            |
| FR-02 | Users are subscribed to all notifications by default (opt-out model). Unchecking a box persists the preference immediately.                             |
| FR-03 | A user is considered subscribed if no preference row exists for their `(userId, subscriptionKey)` pair, or if the existing row has `subscribed = true`. |

### Technical Requirements

| ID    | Requirement                                                                                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Emails are sent via AWS SES using `@aws-sdk/client-ses`. Credentials come from `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` env vars; sender from `SES_FROM_EMAIL`.                                      |
| TR-02 | CSS is inlined before sending using the `juice` npm package. Both packages are dependencies of `@my-hub/shared`.                                                                                                       |
| TR-03 | Notification subscription preferences are stored in the `notification_preferences` table: `(id, user_id, subscription_key text, subscribed boolean, updated_at)` with a unique index on `(user_id, subscription_key)`. |
| TR-04 | `NOTIFICATION_SUBSCRIPTIONS` in `packages/shared/src/services/notifications/config.ts` is the single source of truth for subscription keys, labels, and section groupings. Never use PG enums for subscription keys.   |
| TR-05 | `getSubscribedUserIds(subscriptionKey)` in `packages/shared/src/services/notifications/notifications.ts` returns all active user IDs who have not explicitly unsubscribed.                                             |
| TR-06 | Hub API routes for notification preferences: `GET /api/user/notification-preferences` returns all subscription states; `PUT /api/user/notification-preferences` upserts a single key.                                  |
| TR-07 | Emails use a dark-theme HTML design with inline CSS (via `juice`), compatible with Gmail and Outlook.                                                                                                                  |

---

## Calories: Weekly & Monthly Reports

Weekly and monthly calorie summary emails, sent automatically to all subscribed users. Each email contains calorie summaries, macro breakdowns, an inline SVG weight chart, and body measurements for the period.

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-10 | A weekly report email is sent every Monday at 06:00 (UTC), covering the previous Mon–Sun week.                                                                                                                                                                                                    |
| FR-11 | A monthly report email is sent on the 1st of each month at 06:00 (UTC), covering the prior calendar month.                                                                                                                                                                                        |
| FR-12 | If a user logged zero meals in the reporting period, no email is sent for that period/user.                                                                                                                                                                                                       |
| FR-13 | The weekly report contains: header with date range, week number, and on-track/over verdict; 3 summary stat cards; daily calorie bar chart (Mon–Sun) with goal line; macro split (carbs/protein/fat); weight sparkline SVG (only if ≥ 2 measurements); body measurements grid; next-week outlook.  |
| FR-18 | In the weekly report, the 3rd summary card represents target deviation over logged days (not an assumed 7-day deficit when days are missing).                                                                                                                                                     |
| FR-19 | Weekly report weight progress shows week-start baseline, projected end-of-week, actual end-of-week, and delta vs projection. If Monday weight is missing, baseline falls back to prior-week latest weight when available.                                                                         |
| FR-20 | Weekly report body measurements are a week-end snapshot (values up to report week end), and the weight value is explicitly labeled as week-end weight.                                                                                                                                            |
| FR-14 | The monthly report contains: header with month/year and verdict; 3 summary stat cards; week-by-week calorie breakdown; macro averages; weight trend chart SVG; body composition progress table (start vs end); calorie consistency (days logged, longest streak); monthly outlook.                |
| FR-15 | The Profile → Notifications → Calories section has two checkboxes: "Weekly Report" and "Monthly Report".                                                                                                                                                                                          |
| FR-16 | A `GET /api/calories/reports/weekly-preview?weekStart=YYYY-MM-DD` endpoint returns `{ html }` with the rendered weekly report for the authenticated user (no footer). Defaults to the previous week when `weekStart` is omitted. Returns `{ skipped: "no_data" }` when no meals were logged.      |
| FR-17 | A `GET /api/calories/reports/monthly-preview?monthStart=YYYY-MM-DD` endpoint returns `{ html }` with the rendered monthly report for the authenticated user (no footer). Defaults to the previous month when `monthStart` is omitted. Returns `{ skipped: "no_data" }` when no meals were logged. |

### Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-10 | Email HTML is built by TypeScript template functions (no template engine): `buildWeeklyReportHtml(data: BuildWeeklyReportHtmlData)` and `buildMonthlyReportHtml(data: BuildMonthlyReportHtmlData)` in `packages/shared/src/services/email/templates/`. Both types have an optional `urls?: { unsubscribeUrl, viewInAppUrl }` field. The footer (unsubscribe + view-in-app links) is only rendered when `urls` is provided — omit it for UI preview mode. When sending real emails the worker injects `urls`; preview routes pass data through without `urls`. |
| TR-11 | Worker cron schedules: weekly reports `0 8 * * 1` (Monday 08:00), monthly reports `0 8 1 * *` (1st of month 08:00). Both run in `packages/worker/src/poll.ts`.                                                                                                                                                                                                                                                                                                                                                                                                |
| TR-12 | BMR and TDEE are calculated using `calculateBMR` and `calculateCalorieTargets` from `packages/shared/src/utils/calories.ts` (Mifflin-St Jeor).                                                                                                                                                                                                                                                                                                                                                                                                                |
| TR-13 | All kcal values use `toLocaleString('en-US')` for thousands separators. Signed deltas use the proper minus sign U+2212 (`−`), not a hyphen.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| TR-14 | The weight sparkline SVG is only rendered if ≥ 2 weight measurements exist in the period; otherwise a plain text note is shown.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| TR-15 | Weekly report measurement snapshot values must be sourced from measurements with `date <= weekEnd` to avoid leaking newer values into historical reports.                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## Open Questions

- [x] Should reports be sent in the user's local timezone or UTC? → UTC for simplicity (cron fires at UTC 08:00).

---

## Acceptance Criteria

### Notification System

- [x] Profile → Notifications section is present with feature-grouped checkboxes.
- [x] Unchecking any notification type prevents that email from being sent in subsequent runs.
- [x] Checking restores the subscription.

### Calories Reports

- [x] Weekly email arrives every Monday with correct date range and week number.
- [x] Monthly email arrives on the 1st with correct month label.
- [x] No email is sent when zero meals were logged in the period.
- [x] Verdict badge shows "On track" (green) when average daily intake ≤ goal, "Over" (red) otherwise.
- [x] Daily bar chart shows 7 bars with goal line; bars are colour-coded by delta.
- [x] Weight sparkline renders when ≥ 2 measurements exist; falls back to text note otherwise.
- [x] Profile → Notifications → Calories shows "Weekly Report" and "Monthly Report" checkboxes.
- [x] `GET /api/calories/reports/weekly-preview` returns `{ html }` with rendered report HTML (no footer) for authenticated user.
- [x] `GET /api/calories/reports/monthly-preview` returns `{ html }` with rendered report HTML (no footer) for authenticated user.
- [x] Preview endpoints return `{ skipped: "no_data" }` for a user with no meal logs in the period.
