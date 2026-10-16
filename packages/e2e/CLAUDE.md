# E2E Test Guidelines (`packages/e2e`)

Hub UI + REST Playwright specs. MCP tool tests belong in `packages/mcp-server/e2e`, not here. To run specs
locally, load the `e2e-tests` skill (one sandbox command + one Playwright command).

## Writing specs

- **One test per user journey**, each step building on the last
  (`'full trip journey: create through delete covering all features'`), not one test per assertion. Split a test
  out only when it cannot share state: precise relative timestamps, a disposable resource (e.g. cancelling ends
  the flow), seeded fixtures or another user, a mid-test reload to prove persistence, a different page, or a
  destructive flow with teardown.
- One `test.describe` per file with a `beforeEach` that opens the feature page; mark phases with
  `// ── N. Phase name`.
- Role-based locators (`getByRole`, `getByLabel`, `getByPlaceholder`); scope to a section with
  `page.getByRole('heading', { name }).locator('xpath=ancestor::section[1]')`. Responsive duplicates: scope to
  `[data-layout="desktop"]` unless testing mobile.
- Helpers live at the top of the spec unless several specs share them (`helpers.ts`, `finances-helpers.ts`,
  `travel-helpers.ts`): `createX(page, name)`, `getXIdByName`, `uniqueName(prefix)`. Helpers set up state; they
  don't assert.

## Seeds

- Fixtures: `seeds/*.seed.ts`, orchestrated by `scripts/setup-e2e-db.ts` (CI runs it compiled inside the `hub`
  container). Never move them into MCP setup scripts or migrations.
- `global.setup.ts` must not import seed modules (Playwright's CJS loader breaks on the ESM graph): with
  `IS_LOCAL=true` it spawns `setup-e2e-db.ts` as a child process.
- `seeds/sandbox.seed.ts` is **not** a fixture: it backs `pnpm ui:sandbox` (own user + `Sandbox Demo` budget) and
  no spec may assert against it.
