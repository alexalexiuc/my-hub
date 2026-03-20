# my-hub

A self-hosted personal MCP (Model Context Protocol) hub that gives Claude AI agents access to your personal data — calorie tracking, todos, and more — through a secure OAuth 2.1 layer.

## What it does

**my-hub** runs two MCP servers behind a single authenticated endpoint:

- **Calories** — log meals, track macros, set weight goals, record body measurements, and get AI-driven progress analysis over rolling 7 or 30-day windows
- **Todo** — manage a simple personal todo list

Claude (or any MCP-compatible client) connects to the hub, authenticates via OAuth 2.1 + PKCE, and can then call tools and read resources to answer questions like _"how are my calories this week?"_ or _"add milk to my shopping list"_.

A **Next.js dashboard** (`hub`) lets you view and manage all your data in one place: meal history with charts, weight trends, OAuth clients, invite tokens, and MCP request logs.

## Packages

| Package               | Purpose                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/mcp-server` | Fastify HTTP server — MCP transport, OAuth endpoints, tool & resource registration             |
| `packages/hub`        | Next.js admin dashboard — data UI, OAuth client management, request monitoring                 |
| `packages/shared`     | Drizzle ORM schema, service layer, shared types — the single source of truth for all DB access |
| `packages/e2e`        | Playwright end-to-end tests                                                                    |

## Tech stack

- **Runtime**: Node.js 22+, TypeScript (ESM, strict)
- **MCP**: `@modelcontextprotocol/sdk` 1.x
- **API server**: Fastify
- **Frontend**: Next.js 16 App Router, React 18, Tailwind CSS, Recharts
- **Database**: PostgreSQL 18, Drizzle ORM
- **Auth**: OAuth 2.1 + PKCE, NextAuth.js (Google OAuth for the dashboard)
- **Build**: Turbo, tsup, pnpm workspaces
- **Testing**: Vitest (unit), Playwright (e2e)
- **Infra**: Docker Compose, Traefik (reverse proxy + TLS)

## Quick start

### Prerequisites

- Node.js 22+, pnpm 9+
- Docker & Docker Compose (for the database)
- A PostgreSQL 18 instance **or** use the local Compose stack

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in the required values — see comments in .env.example
```

Key variables:

| Variable                    | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `DATABASE_URL`              | PostgreSQL connection string                   |
| `MCP_SERVER_PORT`           | Port for the MCP/Fastify server (default 3001) |
| `HUB_PORT`                  | Port for the Next.js dashboard (default 3000)  |
| `NEXTAUTH_SECRET`           | Random secret for NextAuth session signing     |
| `GOOGLE_CLIENT_ID / SECRET` | Google OAuth credentials for dashboard login   |
| `MCP_JWT_SECRET`            | Secret for signing MCP session tokens          |
| `ENCRYPTION_KEY`            | Key for encrypting stored OAuth tokens         |

### 3. Run database migrations

```bash
pnpm db:migrate
```

### 4. Start in development mode

```bash
pnpm dev
```

This starts both the MCP server (`:3001`) and the hub dashboard (`:3000`) in watch mode via Turbo.

## MCP servers

### Calories (`/api/calories/mcp`)

#### Resources

| URI                         | Description                                                                     |
| --------------------------- | ------------------------------------------------------------------------------- |
| `calories://profile`        | TDEE, calorie targets (goal/min/max), and latest body measurements              |
| `calories://today`          | All meals logged today with macro totals and progress vs target                 |
| `calories://history-7days`  | Rolling 7-day summary — per-day calories & macros, weight logs, period averages |
| `calories://history-30days` | Same structure as `history-7days` but covering the last 30 days                 |

#### Tools

| Tool                             | Description                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| `calories_log_meal`              | Log a meal; supports multi-item entries in one call             |
| `calories_get_meals`             | Retrieve individual meal entries (with `meal_id`s for deletion) |
| `calories_delete_meal`           | Delete a meal by `meal_id`                                      |
| `calories_update_profile`        | Set demographics, activity level, and weight goal               |
| `calories_get_daily_summary`     | Full calorie/macro breakdown for a specific date                |
| `calories_get_history`           | Calorie and weight history for a custom date range              |
| `calories_log_measurement`       | Log a body measurement (weight, waist, etc.)                    |
| `calories_get_measurements`      | Retrieve measurement entries by type and/or date range          |
| `calories_get_measurement_types` | List available measurement types with units                     |
| `calories_delete_measurement`    | Delete a measurement entry by ID                                |

### Todo (`/api/todo/mcp`)

| Tool             | Description                         |
| ---------------- | ----------------------------------- |
| `todo_add`       | Add a new todo item                 |
| `todo_mark_done` | Mark a todo as done by ID           |
| `todo_list`      | List all todos (open and completed) |

## Connecting Claude to your hub

1. In the dashboard, go to **OAuth Clients** and register a new client for Claude.ai
2. In [Claude.ai settings](https://claude.ai), add an MCP server pointing to `https://your-domain/api/calories/mcp` (or `/api/todo/mcp`)
3. Authorise via the OAuth flow — Claude will then have access to your tools and resources

## Deployment

The `infra/` directory contains Docker Compose files for each environment:

```bash
# Local — direct ports, no Traefik
pnpm start:local

# Production — pulls images from GHCR, Traefik for TLS + routing
pnpm start:prod
```

Services:

| Service | Image             | Default port    |
| ------- | ----------------- | --------------- |
| `db`    | `postgres:18`     | 5432 (internal) |
| `mcp`   | Node.js / Fastify | 3001            |
| `hub`   | Next.js           | 3000            |
| `proxy` | Traefik           | 80 / 443        |

See [`docs/server-setup.md`](docs/server-setup.md) for VPS provisioning and [`docs/mcp-oauth-flow.md`](docs/mcp-oauth-flow.md) for the full OAuth 2.1 + PKCE flow.

## Development

```bash
pnpm build        # Build all packages
pnpm typecheck    # TypeScript type-check
pnpm lint         # ESLint
pnpm lint:fix     # ESLint with auto-fix
pnpm format       # Prettier
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright e2e tests
pnpm db:generate  # Generate Drizzle migrations from schema changes
pnpm db:migrate   # Apply pending migrations
pnpm db:studio    # Open Drizzle Studio
```

**Change order** when modifying across packages:

1. `packages/shared` — schema, services, types first
2. `packages/mcp-server` — tools and resources
3. `packages/hub` — UI pages
4. `infra/` — Docker / Traefik config

## License

MIT
