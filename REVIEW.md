# Review checklist

Repo-specific things to check on every diff, on top of plain correctness. The rules come from `CLAUDE.md`; flag
a violation only when the diff introduces it.

## Boundaries

- Drizzle calls (`db.select`, `db.insert`, `tx.…`) outside `packages/shared/src/services/` — must move to a service.
- `console.*` in `packages/worker` or `packages/mcp-server` (use `logger`); `process.env` outside a package's
  `src/config/env.ts`; an eager (non-getter) env read in hub; a new required hub env var without a Dockerfile
  placeholder or `.env.example` entry.
- Hub client code calling global `fetch` instead of `apiFetch`; Fastify/MCP code in hub; hub-only UI logic in shared.
- A new user-owned table without a `deleteAllUser*` service wired into `api/user/delete-all/route.ts`.
- A schema change without a generated migration in `packages/shared/drizzle/`, or a hand-edited generated file.

## Data and money

- Patch objects built with conditional spreads, or `omitNullish` where `null` must clear a field (`omitUndefined`).
- Finances: stored amounts must go through `resolveTransactionMoney`; rates for stored values through the strict
  `getExchangeRateQuote` (never `getExchangeRate`, never a `1.0` fallback); cross-account sums on `reportingAmount`;
  liabilities only via `isLiabilityAccount`. See the `finances-domain` skill.
- A service throwing plain `Error` for user mistakes (should be a `UserInputError` subclass), or a route/tool
  wrapping service calls in try/catch just to translate errors.
- Re-implemented domain maths that has a single owner (calorie targets, weight trend, vacation engine, loan
  amortization, contribution cadence).

## MCP

- CRUD-shaped tool names/semantics where the Hub already offers the CRUD; snake_case input fields; missing
  annotations; a tool defined but not registered in `tools/tools.ts`; I/O inside `create<Domain>Server()`.
- Tool descriptions that no longer match behaviour, or neighbouring descriptions not updated.

## Hub UI

- Literal Tailwind colours (`bg-emerald-600`, `text-white` on `--accent`) inside themed UI; inline `style` for
  static values; bare `<input>`/`<select>` instead of `@/components` controls.
- New `src/components/*.tsx` without its story, test and barrel export; util functions inside `.tsx` files;
  pages growing past ~300 lines; responsive duplicates without `data-layout`.

## Tests and docs

- Behaviour change without a unit test; a Hub E2E spec asserting against the sandbox seed; MCP tool tests placed
  in `packages/e2e`.
- Feature behaviour changed without updating `docs/requirements/…/feature-<name>.md` (status, FR rows,
  acceptance criteria).

## Known false positives — do not flag

- `z.enum(SomeConst)` where `SomeConst` is an `as const` object: valid in Zod v4 (`zod@^4`). Do not suggest
  `z.nativeEnum`.
- snake_case fields in persisted JSONB shapes (`FlightDetails`, `TransportDetails`), Drizzle column-name strings
  and OAuth payloads (`client_id`, `redirect_uri`, `refresh_token`).
- `numeric(18,4|8)` via `numericCasted` for finance money columns.
