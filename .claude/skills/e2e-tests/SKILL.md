---
name: e2e-tests
description: |
  Use when writing, fixing or running end-to-end tests locally — Hub Playwright specs (packages/e2e/tests/*.spec.ts)
  or MCP tool suites (packages/mcp-server/e2e/*.e2e.ts): "run the e2e", "add an e2e test", "does the spec pass",
  "reproduce the CI E2E failure". Gives the exact commands for a fresh container, no dev credentials needed.
metadata:
  scope: monorepo
  stage: verification
---

# E2E tests

CI (`.github/workflows/e2e.yml`, step "Run E2E tests" = `pnpm test:e2e`) runs **both** suites against a staging
deploy of the PR's images. Locally you run them against throwaway databases.

## Hub Playwright specs

```bash
pnpm ui:sandbox --prod > "$SCRATCH/sandbox.log" 2>&1 &   # next build + start; first run ~3–5 min
until grep -q "Sandbox ready" "$SCRATCH/sandbox.log"; do sleep 5; done
cd packages/e2e
IS_LOCAL=true DATABASE_URL=postgresql://myhub:myhub@127.0.0.1:5432/myhub_sandbox \
  E2E_HUB_BASE_URL=http://localhost:3000 npx playwright test tests/vacation.spec.ts --reporter=line
cd ../.. && pnpm ui:sandbox --stop
```

- `IS_LOCAL=true` makes `global.setup.ts` seed the E2E fixtures into `DATABASE_URL` and register
  `e2e-hub@test.local` (the sandbox allows that address). `global.teardown.ts` wipes that user's data afterwards.
- Use `--prod`: `next dev` compiles routes on first hit and specs time out. After hub code changes, restart
  without `--no-build`.
- Failures leave `test-results/<test>/error-context.md` (page snapshot) and a screenshot — read those before
  re-running. They are git-ignored; don't commit them.
- Type-check specs: `pnpm --filter @my-hub/e2e exec tsc --noEmit -p .` (no typecheck script there).
- Writing conventions (journeys, locators, helpers, seeds): `packages/e2e/CLAUDE.md`.

## MCP suites (vitest over the MCP protocol)

```bash
pnpm db:scratch create
cd packages/mcp-server
export E2E_MCP_CLIENT_ID=hub_e2e$(openssl rand -hex 4) E2E_MCP_CLIENT_SECRET=$(openssl rand -hex 24)
pnpm -w db:scratch exec -- npx tsx e2e/scripts/setup-e2e-db.ts > /dev/null   # provisions user + OAuth client
pnpm -w db:scratch exec -- sh -c 'MCP_SERVER_PORT=3901 npx tsx src/main.ts' > "$SCRATCH/mcp.log" 2>&1 &
E2E_MCP_BASE_URL=http://localhost:3901 npx vitest run --config vitest.e2e.config.ts e2e/<domain>.e2e.ts
kill %1; pnpm -w db:scratch drop
```

- Without `--write-env` the setup script leaves your `e2e/.env.e2e` alone. With a configured local DB instead:
  `pnpm --filter @my-hub/mcp-server e2e:setup` once, then `pnpm --filter @my-hub/mcp-server test:e2e`.
- Tests use `createMcpClient` / `callTool` from `e2e/helpers`, tag data with a run id and clean up in `afterAll`.
  Template: `vacation.e2e.ts`.
- Anything personal loaded into the scratch DB disappears with `drop`; never copy it into seeds or tests.
