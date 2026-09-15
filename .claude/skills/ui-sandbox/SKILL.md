---
name: ui-sandbox
description: |
  This skill should be used when you need to actually look at the Hub UI — to
  "run the app", "start the hub", "take a screenshot", "verify the page renders",
  "check how this looks", or confirm a UI change works in the real app rather than
  only in tests. Applies to `packages/hub` in this repository.
metadata:
  scope: hub
  stage: verification
---

# Running the Hub UI in a sandbox

`pnpm ui:sandbox` brings up a throwaway Hub instance with demo data. Use it whenever a UI change
deserves to be looked at, not just typechecked — it works in a fresh container with no prior setup.

```bash
pnpm ui:sandbox                 # migrate + seed + hub on :3000
pnpm ui:sandbox --port 3100     # pick a port
pnpm ui:sandbox --skip-seed     # reuse the existing sandbox DB (faster restarts)
pnpm ui:sandbox --seed-only     # refresh the data, don't start a server
pnpm ui:sandbox --months 36     # more history (default 21, which spans two calendar years)
```

Sign in with **sandbox@test.local / SandboxPass123!**.

## What it touches

- Its own database (`myhub_sandbox` by default) — never your dev or E2E data. Override with
  `SANDBOX_DATABASE_URL`, or the `SANDBOX_PG*` vars for the pieces.
- Its own user and a `Sandbox Demo` budget, dropped and rebuilt on every seeded run.
- Placeholder secrets only; the sandbox never calls Google, SES, or any third party.

It starts a local PostgreSQL itself when one is installed but not running, so on a clean container
the single command is enough.

## Driving it

Chromium is preinstalled at `/opt/pw-browsers/chromium` and Playwright is already configured for
it — **do not run `playwright install`**. Drive the running sandbox from `packages/e2e` so the
`@playwright/test` import resolves:

```js
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
const page = await context.newPage();
// Sign in once per context — a fresh context has no session cookie and will bounce to /auth/signin.
```

Collect `console` errors and `pageerror` events while you drive; an empty list is part of the
verification, not an afterthought. Check both desktop (1280px) and mobile (390px) — finance
amount columns are the usual thing that overflows on a phone.

## Changing the demo data

The fixtures live in `packages/e2e/seeds/sandbox.seed.ts`, run by
`packages/e2e/scripts/setup-sandbox-db.ts`. They are deliberately **not** E2E fixtures — Playwright
specs must never assert against them, so the numbers are free to change. Add data for a feature area
by extending that seed, not by hand-writing rows or adding a migration.
