# E2E Test Guidelines (`packages/e2e`)

## Test philosophy: natural flow over granularity

Tests should reflect how a real user interacts with the app — not a QA checklist of isolated feature toggles.

**Prefer one test per logical flow.** Instead of creating a separate test for every single assertion, group related scenarios into a single end-to-end journey where each step builds on the previous one. This produces tests that are easier to read, faster to run, and closer to real usage.

```
// Bad: each test creates its own resource for a micro-scenario
test('adds an item', ...)    // creates resource A
test('edits an item', ...)   // creates resource B
test('deletes an item', ...) // creates resource C

// Good: one flow, natural progression
test('full item lifecycle: add, edit, delete', async ({ page }) => {
  // create item → verify visible → edit → verify updated → delete → verify gone
})
```

## When to use a separate test

Break out a separate test only when it genuinely cannot share state with the main flow:

| Reason                                                    | Example                                              |
| --------------------------------------------------------- | ---------------------------------------------------- |
| Requires precise relative timestamps                      | Time-state chip tests (past/imminent/future offsets) |
| Requires a dedicated disposable resource                  | Cancelled trip filter — cancelling ends the flow     |
| Uses seeded fixture data or a different user session      | Shared trip read-only view (`SHARED_TRIP_FIXTURE`)   |
| Needs a mid-test page reload to verify server persistence | Profile goals reload test                            |
| Navigates to a completely different page context          | Home page tile links                                 |
| Destructive flow with teardown that resets shared state   | Two-step delete confirmation flows                   |

## Test structure conventions

- **One `test.describe` block per feature file.** Use a `beforeEach` that navigates to the feature page.
- **Name journey tests descriptively:** `'full trip journey: create through delete covering all features'` beats `'trip CRUD'`.
- **Comment each logical phase** with a short `// ── N. Phase name` header so the test is scannable at a glance.
- **Scope locators to sections** using `page.getByRole('heading', { name: '...' }).locator('xpath=ancestor::section[1]')` to avoid cross-section selector collisions when multiple similar controls exist on the page.
- **Prefer role-based locators** (`getByRole`, `getByPlaceholder`, `getByLabel`) over CSS class selectors. Use CSS only when no semantic alternative exists, and keep it scoped.
- **Use `data-layout` to disambiguate responsive duplicates.** When a component renders both a desktop and a mobile variant (controlled by Tailwind responsive classes), both are in the DOM simultaneously and generic locators will match twice. Scope to the layout you mean: `page.locator('[data-layout="desktop"]').getByText('Savings Transfer')`. Prefer the desktop variant in tests unless the scenario is specifically testing the mobile view.

## Helpers

Shared helpers live at the top of each spec file (not in a separate utils module unless reused across multiple specs). Keep them small and focused — a helper that sets up state and returns nothing is fine; a helper that also makes assertions is harder to debug.

| Pattern                              | Example                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| `createX(page, name)`                | Creates a resource via UI and waits for it to appear            |
| `getXIdByName(page, name)`           | Fetches a resource ID from the API by name                      |
| `uniqueName(prefix)`                 | Generates a timestamped unique name to avoid fixture collisions |
| `ensureUserExists(page, email, ...)` | Registers a user or accepts 409 if already exists               |

## Seed data

Hub E2E seed files live in `packages/e2e/seeds/` and are orchestrated by `packages/e2e/scripts/setup-e2e-db.ts`. Do not move Hub E2E fixtures into MCP setup scripts or DB migrations.

## Running tests

```sh
pnpm --filter @my-hub/e2e test:e2e
```

Set `IS_LOCAL=true` to run the seed script locally before the test suite.
