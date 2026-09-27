---
name: verify
description: |
  Use before reporting work as done, before committing, or when asked to "verify", "run the checks", "make sure
  everything passes". Runs typecheck, unit tests and lint for the packages the current changes touch, in the
  order that avoids stale-build false errors.
metadata:
  scope: monorepo
  stage: verification
---

# Verify the working tree

1. **Scope.** `git status --short` (and `git diff --stat main...HEAD` on a branch) → which of `shared`,
   `mcp-server`, `hub`, `worker`, `e2e` changed. A change in `packages/shared` affects every package.

2. **Build shared first** when it changed — the others compile against `packages/shared/dist`:
   `pnpm --filter @my-hub/shared build`

3. **Typecheck** — `pnpm typecheck` (turbo, all packages; hub regenerates Next route types first, so stale
   `.next/types` cannot fail it).

4. **Unit tests** per touched package. rtk's vitest filter cannot parse this repo's output
   ("All parsing tiers failed"), so bypass it:

   ```bash
   cd packages/<pkg> && rtk proxy npx vitest run 2>&1 | grep -E "Test Files|Tests |FAIL|×"
   ```

5. **Lint** the touched paths with autofix, then re-run tests if files changed:
   `cd packages/<pkg> && pnpm exec eslint --fix <paths>` (the pre-commit hook runs eslint + prettier on staged
   files anyway).

6. **Beyond unit tests**, when the change warrants it:
   - DB queries or migrations → run them against `pnpm db:scratch` (see `ui-sandbox` skill, "Throwaway database").
   - MCP tools → the domain's `e2e/<domain>.e2e.ts` against a local server on the scratch DB.
   - Hub pages → `ui-sandbox`, desktop 1280px and mobile 390px, with console errors collected.

Report counts per package (e.g. "shared 477, mcp-server 137, hub 373") and anything you could not run.
