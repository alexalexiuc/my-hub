---
name: ui-sandbox
description: |
  Use when you need to actually look at the Hub UI — "run the app", "start the hub", "show screenshots", "verify
  the page renders", "check how this looks on mobile", or confirm a UI change in the real app rather than only in
  tests. Applies to packages/hub. Starts a throwaway Hub with demo data and screenshots pages with one command each.
metadata:
  scope: hub
  stage: verification
---

# Running and screenshotting the Hub

```bash
pnpm ui:sandbox > "$SCRATCH/sandbox.log" 2>&1 &     # migrate + seed + next dev on :3000 (run in background)
until grep -q "Sandbox ready" "$SCRATCH/sandbox.log"; do sleep 3; done   # ~1–2 min on a fresh container
cd packages/e2e && node scripts/shoot.mjs /vacation /finances --out "$SCRATCH/shots"   # 390px + 1280px, signed in
pnpm ui:sandbox --stop                               # from the repo root; never `pkill -f`
```

(`$SCRATCH` = your scratchpad directory.) Then Read the PNGs and send the useful ones with `SendUserFile`.

- `shoot.mjs` signs in as the sandbox user, waits for `networkidle` (data is fetched client-side — a plain `load`
  screenshot shows empty cards), and exits 1 listing any console/page errors. Options: `--widths 390`, `--full`,
  `--wait 'text=Balance'`, `--base http://localhost:3100`. "no console errors" is part of the verification.
- Other flags: `--port 3100`, `--skip-seed` (fast restart), `--seed-only`, `--months 36`, `--prod` (next build +
  start; add `--no-build` to reuse `.next`). Sign-in: **sandbox@test.local / SandboxPass123!**.
- Own DB (`myhub_sandbox`), own user and `Sandbox Demo` budget, placeholder secrets — never touches dev/E2E data
  or third parties. It starts local PostgreSQL itself. Where `pg_isready`/`su postgres` are missing (WSL), point it
  at a scratch DB: `pnpm db:scratch exec -- sh -c 'SANDBOX_DATABASE_URL="$DATABASE_URL" pnpm ui:sandbox'`.

## Interactions beyond screenshots

Write a throwaway `.mjs` driver in `packages/e2e` (so `@playwright/test` resolves; `.ts` there compiles as CJS, so
no top-level await) and delete it afterwards. Copy the sign-in and error collection from `scripts/shoot.mjs`.
Chromium is at `/opt/pw-browsers/chromium` — never `playwright install`; on WSL launch without `executablePath`.

Touch drag (e.g. selecting a date range on a phone): context `{ hasTouch: true, isMobile: true }`, then CDP:

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

A `next-auth` `CLIENT_FETCH_ERROR` on `/api/auth/session` right after navigating is the aborted fetch of the page
being left, not a bug (shoot.mjs filters it).

## Demo data

`packages/e2e/seeds/sandbox.seed.ts` (`seedSandboxFixtures` → per-domain `seed<Domain>Fixtures`). Not E2E fixtures —
no spec asserts against them, so change them freely. Add data for a feature by extending that seed, never by
hand-written rows or a migration.
