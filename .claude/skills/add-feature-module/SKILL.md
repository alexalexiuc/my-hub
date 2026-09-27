---
name: add-feature-module
description: |
  Use when building a new feature area end to end (a new domain with its own tables, services, Hub page and
  usually an MCP server), e.g. "add a <feature> module", "build a <feature> planner/tracker". Gives the file
  layout and order used by the existing domains (calories, travel, finances, vacation).
metadata:
  scope: monorepo
  stage: design+implementation
---

# Adding a feature module

Reference implementation: the vacation module (`git log --oneline -- packages/shared/src/services/vacation`).
Read `docs/requirements/<area>/` first; if no spec exists, write one as you go.

## 1. shared

| What             | Where                                           | Notes                                                                                                                                           |
| ---------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Enum-like values | `src/constants/<domain>.ts`                     | `as const` object + union type + `…Values` tuple for `z.enum`; export from `constants/index.ts`                                                 |
| Tables           | `src/db/schema/<domain>.ts`                     | `<domain>_` table prefix in `public`; `user_id` FK with `onDelete: 'cascade'`; `real()` money; `.$type<Union>()`; export from `schema/index.ts` |
| Row types        | `src/types/index.ts`                            | `InferSelectModel` per table                                                                                                                    |
| Migration        | `pnpm db:generate`                              | never hand-write schema SQL                                                                                                                     |
| Pure logic       | `src/utils/<domain>.ts` + `.test.ts`            | no DB; unit-test the math against hand-computed cases                                                                                           |
| Services         | `src/services/<domain>/`                        | queries + `deleteAllUser<Domain>Data`; validate first, then one transaction; throw a `UserInputError` subclass for user mistakes                |
| Inventory        | `src/utils/CLAUDE.md`, `src/services/CLAUDE.md` | one entry per new file, plus a JSDoc inventory header                                                                                           |

Then `pnpm --filter @my-hub/shared build`.

## 2. mcp-server (if the feature is exposed to Claude)

Design tools with `mcp-task-tools`, wire the server with `mcp-add-server`, add tools with `mcp-add-tool`.
camelCase inputs; outcome-oriented names; reads return compact rows plus `warnings`.

## 3. hub

- API routes in `src/app/api/<domain>/…/route.ts` using `route({ query|body })`; shared query schemas from
  `@/lib/schemas/common` (`isoDateSchema`, `isoMonthSchema`). `UserInputError` already becomes a 400.
- Page in `src/app/<domain>/` — sections as co-located components, helpers in `<domain>.utils.ts` (+ test),
  colours from theme tokens only (see hub `CLAUDE.md`).
- Link from `src/app/page.tsx`; wire deletion (see `mcp-add-server` step 7).
- If the page is empty without setup, consider a labelled demo mode rather than an error (vacation's
  `allowDemo`).

## 4. demo data, docs, verification

- Sandbox fixtures in `packages/e2e/seeds/sandbox.seed.ts` (`seed<Domain>Fixtures`), never asserted by specs.
- Spec `docs/requirements/<area>/feature-<name>.md` (status, FR/TR tables, acceptance criteria) and
  `PLATFORM_REQUIREMENTS.md` if architecture facts changed.
- Run the `verify` skill; exercise services against real PostgreSQL with `pnpm db:scratch`; look at the page
  with `ui-sandbox`.
