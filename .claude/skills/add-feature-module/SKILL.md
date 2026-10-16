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

Reference implementation: vacation (`git log --oneline -- packages/shared/src/services/vacation`, and the
`vacation-domain` skill). Read `docs/requirements/<area>/` first; if no spec exists, write one from
`docs/requirements/_template.md` as you go.

## 1. shared

| What             | Where                                | Notes                                                                                                                      |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Enum-like values | `src/constants/<domain>.ts`          | `as const` object + union type + `…Values` tuple for `z.enum`; export from `constants/index.ts`                            |
| Tables           | `src/db/schema/<domain>.ts`          | `<domain>_` prefix; `user_id` FK `onDelete: 'cascade'`; `real()` numbers; `.$type<Union>()`; export from `schema/index.ts` |
| Row types        | `src/types/index.ts`                 | `InferSelectModel` per table                                                                                               |
| Migration        | `pnpm db:generate`                   | never hand-write schema SQL; read the generated file                                                                       |
| Pure logic       | `src/utils/<domain>.ts` + `.test.ts` | no DB; unit-test the maths against hand-computed cases                                                                     |
| Services         | `src/services/<domain>/`             | queries + `deleteAllUser<Domain>Data`; validate, then one transaction; `UserInputError` subclass                           |

JSDoc every export (the inventory prints it). Then add a `<domain>-domain` skill with the rules a future session
must not re-derive (copy the shape of `vacation-domain`).

## 2. mcp-server (if Claude should reach it)

`mcp-add-server` for the endpoint, then `mcp-tool` per tool. Outcome-oriented names, camelCase inputs, reads
return compact rows plus `warnings`.

## 3. hub

- API routes `src/app/api/<domain>/…/route.ts` with `route({ query | body })`; `UserInputError` is already a 400.
- Page `src/app/<domain>/`: section components, `<domain>.utils.ts` (+ test), theme tokens only, wrapped in
  `FeatureTheme` if it gets its own theme (see `hub-theming`).
- Link it from `src/app/page.tsx`; wire data deletion (`mcp-add-server` step 8).
- A page that is empty without setup can show a labelled demo (vacation's `allowDemo`) instead of an error.

## 4. Demo data, docs, verification

- Sandbox demo data: a `seed<Domain>Fixtures(userId)` called from `seedSandboxFixtures` in
  `packages/e2e/seeds/sandbox.seed.ts` (never asserted by specs).
- E2E: a Hub journey spec (`packages/e2e/tests/<domain>.spec.ts`) and an MCP suite — `e2e-tests` skill.
- Finish with `verify` (plus services against real Postgres via `pnpm db:scratch`) and `ship`; look at the page
  with `ui-sandbox`.
