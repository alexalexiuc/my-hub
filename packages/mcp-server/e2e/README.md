# MCP Server — E2E Tests

Black-box integration tests that run against a live MCP server instance (local or staging).

## How it works

Tests use the MCP Streamable HTTP protocol to call tools and verify responses, without
inspecting the database directly. The test suite covers:

- **Health endpoint** — status, unknown routes, unauthenticated access
- **Calories meal lifecycle** — log meal → retrieve → filter → delete → verify gone

## Local setup (one-time)

1. Add the following to your root `.env` (they are already listed there as commented-out examples):

   ```dotenv
   E2E_MCP_USER_EMAIL=e2e-mcp@test.local
   E2E_MCP_CLIENT_ID=e2e_test_client_id
   E2E_MCP_CLIENT_SECRET=e2e_test_client_secret
   ```

2. Run the setup script once from `packages/mcp-server`:

   ```bash
   pnpm --filter mcp-server e2e:setup
   ```

   This provisions the test user and OAuth client in the local database and writes
   `e2e/.env.e2e` with `E2E_MCP_CLIENT_ID`, `E2E_MCP_CLIENT_SECRET`, and `E2E_MCP_USER_ID`.
   Tests load this file automatically — no manual env exports needed.

## Running locally

```bash
# From repo root — reads credentials from e2e/.env.e2e written by the setup script
pnpm --filter mcp-server test:e2e

# Or against staging (override the base URL; credentials still come from .env.e2e)
E2E_MCP_BASE_URL=https://mcp.example.com pnpm --filter mcp-server test:e2e
```

## Environment variables

| Variable                | Source        | Description                                        |
| ----------------------- | ------------- | -------------------------------------------------- |
| `E2E_MCP_CLIENT_ID`     | `e2e:setup`   | OAuth client ID of the provisioned test client     |
| `E2E_MCP_CLIENT_SECRET` | `e2e:setup`   | OAuth client secret (plain-text)                   |
| `E2E_MCP_USER_EMAIL`    | `e2e:setup`   | Email of the test user                             |
| `E2E_MCP_BASE_URL`      | optional / CI | Server base URL (default: `http://localhost:3001`) |

## CI / GitHub Actions

The workflow (`.github/workflows/e2e.yml`) runs automatically after a successful deploy
to `staging`. It reads credentials from GitHub repository secrets:

- `STG_MCP_SERVER_URL` — staging server URL (set once the domain is known)
- `E2E_MCP_CLIENT_ID`
- `E2E_MCP_CLIENT_SECRET`
- `E2E_MCP_USER_ID`

You can also trigger it manually from the **Actions** tab with a custom base URL.
