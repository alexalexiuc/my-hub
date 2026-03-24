# MCP OAuth Flow — How Claude.ai Connects

This document explains the end-to-end OAuth 2.1 + PKCE flow that Claude.ai (or Claude
Desktop) goes through to authenticate against the Hub's MCP server.

The implementation lives primarily in `packages/mcp-server/src/routes/oauth.ts`.

---

## Overview

The Hub acts as both the **OAuth Authorization Server** and the **MCP resource server**.
Claude.ai is the OAuth client. The flow follows
[RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) (Authorization Code),
[RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) (PKCE), and
[RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) (Dynamic Client Registration).

```
Claude.ai                    Hub (MCP server)               User (browser)
    |                              |                              |
    |--- GET /.well-known/... ---->|                              |
    |<-- OAuth server metadata ----|                              |
    |                              |                              |
    |--- POST /api/register ------>|                              |
    |<-- client_id + client_secret-|                              |
    |                              |                              |
    |--- redirect to /api/authorize>|-------consent page -------->|
    |                              |<------- user approves -------|
    |<-- redirect with auth code --|                              |
    |                              |                              |
    |--- POST /api/token --------->|                              |
    |<-- access_token -------------|                              |
    |                              |                              |
    |--- MCP calls (Bearer token)->|                              |
```

---

## Step 1 — Discovery

Claude.ai may first fetch the protected-resource metadata and then the authorization-server metadata:

```
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-authorization-server
```

`oauth-protected-resource` tells the client which authorization server protects this resource.
`oauth-authorization-server` advertises `/api/register`, `/api/authorize`, and `/api/token`, and
declares that PKCE S256 is required.

---

## Step 2 — Dynamic Client Registration (`POST /api/register`)

Claude.ai registers itself **before** any user interaction. This happens once per
Claude installation/workspace.

**Request:**

```json
{
  "client_name": "Claude",
  "redirect_uris": ["https://claude.ai/...callback"]
}
```

**Response (201):**

```json
{
  "client_id": "hub_3f9a1b2c",
  "client_secret": "<uuid — shown once>",
  "client_name": "Claude",
  "redirect_uris": ["https://claude.ai/...callback"]
}
```

Key points:

- `client_id` uses the prefix `hub_` + 8 hex chars for human readability.
- `client_secret` is a single UUID (128-bit). It is scrypt-hashed before storage and
  **never retrievable again**.
- A separate `tokenSigningSecret` (3 stripped UUIDs, 288-bit) is generated and stored
  encrypted in the DB. It is never sent to the client; it is used to sign tokens issued
  to this client only.

> This is where `clientId` and `clientSecret` originate — at registration, not at the
> end of the flow.

---

## Step 3 — Authorization Request (`GET /api/authorize`)

Claude.ai redirects the user's browser to the MCP server's consent page:

```
GET /api/authorize
  ?client_id=hub_3f9a1b2c
  &response_type=code
  &redirect_uri=https://claude.ai/callback
  &code_challenge=<base64url(SHA256(verifier))>
  &code_challenge_method=S256
  &state=<random>
```

The MCP server:

1. Checks the user has an active NextAuth session. If not, redirects to the Hub's
   sign-in page (`HUB_URL/auth/signin`) with a `callbackUrl` set to the **full
   MCP server authorize URL** (e.g. `https://mcp.alexiuc.dev/api/authorize?...`).
   After login, the user is redirected back to the MCP server — not the Hub.
2. Optionally checks the user's email against `ALLOWED_EMAILS`.
3. Renders a consent page asking the user to approve Claude's access.

---

## Step 4 — User Consents → Auth Code Issued

When the user clicks **Allow**:

1. Hub calls `bindOAuthClientToUser(clientId, userId)` to associate this OAuth client
   with the logged-in user.
2. Hub calls `ensureAllMcpServers(userId)` to provision one MCP server row per server
   type (`calories`, `hive`, `products`, `todo`) for the user — idempotent via
   `ON CONFLICT DO NOTHING`.
3. Hub generates a **short-lived auth code** (5-minute expiry), signed with HMAC-SHA256
   using the client's `tokenSigningSecret`.
4. Hub redirects back to Claude.ai:

```
https://claude.ai/callback?code=<authCode>&state=<state>
```

The auth code is a signed payload (not a random opaque string), structured as:

```json
{
  "client_id": "hub_3f9a1b2c",
  "user_id": "<uuid>",
  "redirect_uri": "https://claude.ai/callback",
  "code_challenge": "<base64url>",
  "code_challenge_method": "S256",
  "exp": "<unix ms + 5 min>"
}
```

---

## Step 5 — Token Exchange (`POST /api/token`)

Claude.ai exchanges the auth code for a long-lived access token:

**Request:**

```json
{
  "grant_type": "authorization_code",
  "client_id": "hub_3f9a1b2c",
  "client_secret": "<uuid from step 2>",
  "code": "<authCode from step 4>",
  "code_verifier": "<original PKCE verifier>",
  "redirect_uri": "https://claude.ai/callback"
}
```

The Hub validates in order:

1. `client_id` exists and `client_secret` matches (scrypt comparison).
2. Auth code signature is valid and not expired.
3. `redirect_uri` matches the one in the auth code.
4. PKCE: `SHA256(code_verifier) == code_challenge` from the auth code.

**Response:**

```json
{
  "access_token": "<token>",
  "token_type": "bearer",
  "expires_in": 86400
}
```

The access token is valid for **24 hours**. No refresh tokens are issued — the full
flow must be repeated after expiry.

---

## Step 6 — MCP Calls with Bearer Token

Every MCP request from Claude.ai includes:

```
Authorization: Bearer <access_token>
```

The verifier (`packages/mcp-server/src/plugins/oauth-verifier.ts`):

1. Decodes the token payload without signature verification to extract `client_id`.
2. Looks up the client's `tokenSigningSecret` from the DB.
3. Re-verifies the full HMAC-SHA256 signature and expiry.
4. Returns `userId` extracted from the token for request-scoped data isolation.

---

## Token Format

Tokens are **not JWTs**. The format is:

```
base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
```

This keeps tokens self-contained and verifiable without a shared global secret —
each client has its own signing key.

---

## Revocation

Deleting an OAuth client from the DB immediately invalidates all tokens issued to it,
because token verification requires a DB lookup for the `tokenSigningSecret`. There is
no token blocklist — deletion is the revocation mechanism.

---

## Security Properties

| Property                | Mechanism                                                                     |
| ----------------------- | ----------------------------------------------------------------------------- |
| PKCE S256               | Client proves code verifier before token exchange                             |
| Client secret storage   | Scrypt-hashed, never stored in plain form                                     |
| Token signing           | Per-client HMAC-SHA256 key, encrypted in DB                                   |
| Auth code expiry        | 5 minutes                                                                     |
| Access token expiry     | 24 hours                                                                      |
| Email whitelist         | `ALLOWED_EMAILS` env var                                                      |
| Redirect URI validation | Must match registered URIs exactly; HTTPS required (localhost HTTP allowed)   |
| Data isolation          | `userId` embedded in token; MCP handlers scope all queries by `req.mcpUserId` |

---

## Key Files

| Purpose                                                           | Path                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| OAuth endpoints (`/api/register`, `/api/authorize`, `/api/token`) | `packages/mcp-server/src/routes/oauth.ts`                     |
| Bearer token verifier                                             | `packages/mcp-server/src/plugins/oauth-verifier.ts`           |
| Token signing / verification                                      | `packages/shared/src/auth/index.ts`                           |
| OAuth clients DB service                                          | `packages/shared/src/services/oauth-clients/oauth-clients.ts` |
| OAuth clients DB schema                                           | `packages/shared/src/db/schema/oauth-clients.ts`              |
| MCP server provisioning                                           | `packages/shared/src/services/mcp-servers/mcp-servers.ts`     |
| Hub API routes for client management                              | `packages/hub/src/app/api/mcp/clients/`                       |
