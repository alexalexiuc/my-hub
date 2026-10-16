---
name: worker-email-reports
description: |
  Use when adding or changing a scheduled worker job (packages/worker), an email report (weekly/monthly calorie or
  finance reports, any SES email), or a notification subscription type — "add a cron job", "send a monthly email",
  "new report", "run the job manually", "unsubscribe link".
metadata:
  scope: monorepo
  stage: implementation
---

# Worker jobs and email reports

## Worker (`packages/worker`)

- One file per job in `src/` exporting an async function; registered in the `tasks` array in `src/poll.ts`
  (`{ name, cron, fn }`, croner 6-field or 5-field syntax, `timezone: 'UTC'`, `protect: true` so runs never
  overlap).
- Shared services only (`@my-hub/shared/services`) — no Drizzle, no HTTP routes. `logger` from
  `@my-hub/shared/utils` with a `[worker] <job>` prefix. Env via `src/config/env.ts` lazy getters.
- Jobs that must cover every budget regardless of subscriptions use the `*System` services
  (`getAllBudgetsForSystem`), e.g. `finance-networth-snapshot.ts`.
- Run one job now: `pnpm --filter @my-hub/worker run-task <task-name>` (no name → lists tasks). Against a
  throwaway DB: `pnpm db:scratch exec -- pnpm --filter @my-hub/worker run-task <name>`.
- No unit-test script exists in worker; put testable logic in shared services/utils and test it there.

## Email

- Send through `packages/shared/src/services/email/send-email.ts` (AWS SES, sender `SES_FROM_EMAIL`). HTML
  templates in `services/email/templates/<report-name>/`; shared formatting in `report-format.ts` /
  `finance-report-shared.ts`. Always run the HTML through `juice` (CSS inlining) before sending.
- Report data comes from domain services (`calories/report-data.ts`, `finances/reports.ts`) — templates only
  format.

## Notification subscriptions

- `NOTIFICATION_SUBSCRIPTIONS` in `packages/shared/src/services/notifications/config.ts` is the single source of
  subscription keys, UI labels and sections. Keys are plain `text` columns — never a PG enum.
- The Profile page renders it automatically (`packages/hub/src/app/profile/NotificationsSection.tsx`, persisted via
  `/api/user/notification-preferences`). Unsubscribe links: `unsubscribe-token.ts` (`UNSUBSCRIBE_SECRET`).

## New email report, in order

1. `{ key, label, section }` entry in `NOTIFICATION_SUBSCRIPTIONS`.
2. Data in the domain service; template dir under `templates/`.
3. Worker job in `packages/worker/src/<report>.ts`, registered with its cron in `poll.ts`.
4. Spec: `docs/requirements/hub/feature-email-notifications.md`.
