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

### Without local PostgreSQL tools (WSL talking to a host database)

`pg_isready`/`su postgres` are only used when `SANDBOX_DATABASE_URL` is unset. Point the sandbox at a
scratch database on the dev server instead:

```bash
pnpm db:scratch create
pnpm db:scratch exec -- sh -c 'SANDBOX_DATABASE_URL="$DATABASE_URL" pnpm ui:sandbox --port 3100'
pnpm db:scratch drop            # when done
```

## Driving it

Chromium is preinstalled at `/opt/pw-browsers/chromium` and Playwright is already configured for
it — **do not run `playwright install`**. Where that path does not exist (WSL), a browser is already in
`~/.cache/ms-playwright`: call `chromium.launch()` without `executablePath`. Drive the running sandbox from `packages/e2e` so the
`@playwright/test` import resolves:

```js
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
const page = await context.newPage();
// Sign in once per context — a fresh context has no session cookie and will bounce to /auth/signin.
await page.goto('http://localhost:3000/auth/signin');
await page.getByLabel('Email').fill('sandbox@test.local');
await page.getByRole('textbox', { name: 'Password' }).fill('SandboxPass123!');
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForURL('http://localhost:3000/');
```

Write the driver as a `.mjs` in `packages/e2e` (so `@playwright/test` resolves) and delete it afterwards.
Top-level `await` needs `.mjs`/`.mts`; that package compiles `.ts` as CommonJS.

A `next-auth` `CLIENT_FETCH_ERROR` on `/api/auth/session` right after `page.goto` away from `/` is the
aborted session fetch of the page being left — not a bug in the page under test.

**Touch gestures.** `page.touchscreen` only taps. For a real touch drag (e.g. selecting a range on a
phone), send CDP touch events:

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
for (let i = 1; i <= 8; i++)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y: y0 + ((y1 - y0) * i) / 8 }],
  });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
```

Create the context with `{ hasTouch: true, isMobile: true }` for that.

Collect `console` errors and `pageerror` events while you drive; an empty list is part of the
verification, not an afterthought. Check both desktop (1280px) and mobile (390px) — finance
amount columns are the usual thing that overflows on a phone.

## Changing the demo data

The fixtures live in `packages/e2e/seeds/sandbox.seed.ts`, run by
`packages/e2e/scripts/setup-sandbox-db.ts`. They are deliberately **not** E2E fixtures — Playwright
specs must never assert against them, so the numbers are free to change. Add data for a feature area
by extending that seed, not by hand-writing rows or adding a migration.

## Throwaway database for services and MCP E2E

`pnpm db:scratch create` makes a migrated `myhub_scratch` database on the dev server;
`pnpm db:scratch exec -- <cmd>` (from a package: `pnpm -w db:scratch exec -- <cmd>`) runs a command with
`DATABASE_URL` pointing at it. Use it to run service scripts or the MCP E2E suite without touching dev data:

```bash
pnpm db:scratch create
cd packages/mcp-server
export E2E_MCP_CLIENT_ID=hub_e2e$(openssl rand -hex 4) E2E_MCP_CLIENT_SECRET=$(openssl rand -hex 24)
pnpm -w db:scratch exec -- npx tsx e2e/scripts/setup-e2e-db.ts > /dev/null   # no --write-env: .env.e2e untouched
pnpm -w db:scratch exec -- sh -c 'MCP_SERVER_PORT=3901 npx tsx src/main.ts' &    # stop it afterwards
E2E_MCP_BASE_URL=http://localhost:3901 npx vitest run --config vitest.e2e.config.ts e2e/<domain>.e2e.ts
pnpm -w db:scratch drop
```

Data you load there (including anything personal the user shares) disappears with `drop`; never put it in
seeds or tests.
