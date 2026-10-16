---
name: verify
description: |
  Use before reporting work as done, before committing, or when asked to "verify", "run the checks", "make sure
  everything passes". Runs typecheck, lint and unit tests for the packages the change touches (turbo builds
  shared first, so no stale-dist false errors), plus the extra checks CI runs.
metadata:
  scope: monorepo
  stage: verification
---

# Verify the working tree

1. **Everything CI's `lint-typecheck-test` job runs, for changed packages only:**

   ```bash
   pnpm exec turbo run typecheck lint test:unit --affected --output-logs=errors-only
   ```

   `--affected` compares against `main` (plus uncommitted changes); only failing tasks print logs. A change to
   root config (`tsconfig.base.json`, `eslint.config.mjs`, `prettier.config.mjs`) affects everything — drop
   `--affected` then. Before pushing a large change, run it once without `--affected`.

2. **Lint failures**: `pnpm exec eslint --fix <files>` and `pnpm exec prettier --write <files>` on the files you
   touched (never a whole directory — unrelated docs get reformatted). The pre-commit hook runs lint-staged anyway.

3. **Extra checks when relevant:**

   | You changed                                  | Also run                                                                                                                       |
   | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
   | `packages/e2e` (no typecheck script)         | `pnpm --filter @my-hub/e2e exec tsc --noEmit -p .`                                                                             |
   | hub styles / `scripts/gen-palettes.mts`      | `pnpm --filter @my-hub/hub gen:palettes:check` (CI fails on drift)                                                             |
   | MCP tools                                    | `pnpm --filter @my-hub/mcp-server list-tools <domain>`                                                                         |
   | schema / migrations / raw SQL                | apply against `pnpm db:scratch` (`create`, `exec -- pnpm db:migrate`, `drop`)                                                  |
   | a hub page                                   | `ui-sandbox` skill: 390px + 1280px screenshots, no console errors                                                              |
   | Hub/MCP E2E specs or flows they cover        | `e2e-tests` skill — run the touched specs locally                                                                              |
   | hub env vars / route modules / `next.config` | a production build: `pnpm ui:sandbox --prod --skip-seed` (builds with placeholder secrets, like the Dockerfile), then `--stop` |

4. **Single test file while iterating**: `pnpm --filter @my-hub/<pkg> exec vitest run <path> --reporter=dot`.

Report results per package with counts (e.g. "shared 528, hub 390, mcp-server 128 passed") and name anything you
could not run and why.
