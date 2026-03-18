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

| Variable           | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `E2E_CLIENT_ID`    | The `client_id` of the pre-registered test OAuth client                 |
| `E2E_CLIENT_SECRET`| The OAuth client secret used with the `client_credentials` grant        |
| `E2E_MCP_BASE_URL` | Server base URL for the MCP server (default: `http://localhost:3001`)   |

The test helpers obtain access tokens using the OAuth `client_credentials` flow for this
client against the target MCP server, so no long-lived personal tokens are required.

## Running locally

```bash
# From repo root — points to localhost:3001 by default
E2E_CLIENT_ID=hub_xxxxxxxx \
E2E_CLIENT_SECRET=<client-secret> \
pnpm test:e2e

# Or against staging
E2E_MCP_BASE_URL=https://mcp.example.com \
E2E_CLIENT_ID=hub_xxxxxxxx \
E2E_CLIENT_SECRET=<client-secret> \
pnpm test:e2e
```

## CI / GitHub Actions

The workflow (`.github/workflows/e2e.yml`) runs automatically after a successful deploy
to `staging`. It reads credentials from GitHub repository secrets:

- `STG_MCP_SERVER_URL` — staging server URL (set once the domain is known)
- `E2E_CLIENT_ID`
- `E2E_CLIENT_SECRET`

You can also trigger it manually from the **Actions** tab with a custom base URL.

## Obtaining credentials

1. Register a confidential OAuth client for the MCP server that supports the
   `client_credentials` grant (via the hub UI or a one-off script).
2. Store the returned `client_id` and `client_secret` as repository or environment secrets.

> The client secret should be treated as sensitive and rotated if it is ever exposed.
