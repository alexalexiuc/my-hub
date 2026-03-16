# MCP Server — E2E Tests

Black-box integration tests that run against a live MCP server instance (local or staging).

## How it works

Tests use the MCP Streamable HTTP protocol to call tools and verify responses, without
inspecting the database directly. The test suite covers:

- **Health endpoint** — status, unknown routes, unauthenticated access
- **Calories meal lifecycle** — log meal → retrieve → filter → delete → verify gone

## Prerequisites

A pre-registered OAuth client must exist in the target server's database.
Set these env vars before running:

| Variable                   | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `E2E_CLIENT_ID`            | The `client_id` of the pre-registered test OAuth client        |
| `E2E_TOKEN_SIGNING_SECRET` | The **raw** (unencrypted) token signing secret for that client |
| `E2E_USER_ID`              | UUID of the user the client is authorized for                  |
| `E2E_BASE_URL`             | Server base URL (default: `http://localhost:3001`)             |

The test helper generates a fresh signed access token for each run using these credentials,
so tokens never expire between CI runs.

## Running locally

```bash
# From repo root — points to localhost:3001 by default
E2E_CLIENT_ID=hub_xxxxxxxx \
E2E_TOKEN_SIGNING_SECRET=<raw-secret> \
E2E_USER_ID=<uuid> \
pnpm test:e2e

# Or against staging
E2E_BASE_URL=https://mcp.example.com \
E2E_CLIENT_ID=hub_xxxxxxxx \
E2E_TOKEN_SIGNING_SECRET=<raw-secret> \
E2E_USER_ID=<uuid> \
pnpm test:e2e
```

## CI / GitHub Actions

The workflow (`.github/workflows/e2e.yml`) runs automatically after a successful deploy
to `staging`. It reads credentials from GitHub repository secrets:

- `STG_MCP_SERVER_URL` — staging server URL (set once the domain is known)
- `E2E_CLIENT_ID`
- `E2E_TOKEN_SIGNING_SECRET`
- `E2E_USER_ID`

You can also trigger it manually from the **Actions** tab with a custom base URL.

## Obtaining credentials

1. Register a test OAuth client by completing the OAuth flow once (via the hub UI or
   a one-off script).
2. Store the returned `client_id`, the **raw** `tokenSigningSecret` (before DB encryption),
   and the authorized `userId` as secrets.

> The raw `tokenSigningSecret` is only visible at registration time. If lost, register
> a new test client.
