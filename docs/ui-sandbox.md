# UI Sandbox

A throwaway Hub instance with demo data, for looking at the UI. Built for disposable environments —
a CI box, a fresh container, a Claude Code session — where there is no dev database and no fixtures
to work with. It is **not** a replacement for local development: for day-to-day work, run
`pnpm dev:hub` against your own database.

```bash
pnpm ui:sandbox                 # migrate + seed + hub on :3000
pnpm ui:sandbox --port 3100     # pick a port
pnpm ui:sandbox --skip-seed     # reuse the existing sandbox DB (faster restarts)
pnpm ui:sandbox --seed-only     # refresh the data, don't start a server
pnpm ui:sandbox --months 36     # months of history to generate (default 21)
pnpm ui:sandbox --help
```

Sign in with **sandbox@test.local / SandboxPass123!**.

## What it does

1. Starts a local PostgreSQL if one is installed but not running (best effort — Debian/Ubuntu
   `service postgresql start`). If none can be reached it fails with instructions rather than
   guessing.
2. Creates the sandbox role and database if they do not exist.
3. Runs Drizzle migrations against them.
4. Seeds demo fixtures via `packages/e2e/scripts/setup-sandbox-db.ts`.
5. Starts `next dev` with placeholder secrets and waits until the sign-in page answers, then prints
   the URL and credentials.

## Isolation

| Concern  | Sandbox                                                                    |
| -------- | -------------------------------------------------------------------------- |
| Database | `myhub_sandbox` — separate from both the dev database and the E2E database |
| User     | `sandbox@test.local`, distinct from the E2E user (`e2e-hub@test.local`)    |
| Budget   | `Sandbox Demo`, dropped and rebuilt on every seeded run                    |
| Secrets  | Placeholders only — no Google, SES, or other third-party calls             |

Override the connection with `SANDBOX_DATABASE_URL`, or piecewise with `SANDBOX_PGHOST`,
`SANDBOX_PGPORT`, `SANDBOX_PGUSER`, `SANDBOX_PGPASSWORD`, `SANDBOX_PGDATABASE`.

## The fixtures

`packages/e2e/seeds/sandbox.seed.ts` generates a budget with four accounts (bank, goal, credit
card, and one deliberately idle cash account), three categories across two groups, two payees, and
a configurable run of monthly salary / spending / transfer transactions with a slow upward drift.
The default 21 months spans two calendar years, so the Cashflow page's year carousel has a previous
year to page into.

These are **not** E2E fixtures. Playwright specs assert against `packages/e2e/seeds/*.seed.ts`
fixtures seeded by `setup-e2e-db.ts`; nothing asserts against the sandbox seed, so its numbers are
free to change. Extend it when a feature area needs demo data — do not hand-write rows or add a
migration.

## Driving it from an agent session

Chromium is preinstalled in the Claude Code container at `/opt/pw-browsers/chromium` and Playwright
is configured to find it — do not run `playwright install`. See
`.claude/skills/ui-sandbox/SKILL.md` for the agent-facing version of these notes.
