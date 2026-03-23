# Platform Requirements — Self-Hosted Personal MCP Platform

## Context

The platform is a self-hosted personal MCP hub running on a Hetzner VPS with Docker Compose.
The original Cloudflare Workers + Google Sheets MVP has been fully migrated to this platform.

MCP sub-servers currently available:

- **Calorie Tracker** — meal logging, nutritional summaries, user profiles, body measurements
- **Todo** — task management, reminders
- **Apiary** — yard, hive, inspection log, and task management for beekeepers (12 tools, 3 resources)
- **Travel** — trip planning, reservation capture, checklist preparation, companions, and document links
- **Hive Manager** — _(superseded by Apiary)_
- **Products Manager** _(planned)_ — home inventory, shopping lists, product catalog

**Platform repo:** https://github.com/alexalexiuc/my-hub

---

## Target Architecture

### Infrastructure: Hetzner VPS

A single Linux VPS (Ubuntu 24.04 LTS) managing all services via Docker Compose.

**Recommended tier:** CX32 (4 vCPU, 8 GB RAM, 80 GB SSD, ~€8/month)

- Comfortable headroom for PostgreSQL + Fastify + Next.js + Nginx
- Can downgrade to CX22 (2 vCPU, 4 GB RAM, ~€4.5/month) if budget is tight

**Staging:** same VM, separate Docker Compose stack (`docker-compose.staging.yml`), accessible via `staging.mcp.alexiuc.dev` / `staging.hub.alexiuc.dev`.

---

### Services (all Docker containers)

| Service | Technology        | Role                                                   |
| ------- | ----------------- | ------------------------------------------------------ |
| `db`    | PostgreSQL 18     | Primary datastore replacing Google Sheets              |
| `mcp`   | Node.js / Fastify | MCP server(s) — calories, todo, apiary, travel, future |
| `hub`   | Next.js           | Admin panel / personal cabinet                         |
| `proxy` | Traefik           | TLS termination, routing, static assets                |

---

### Database

**Choice: PostgreSQL 18**

- Familiar, battle-tested, excellent TypeScript support
- Relational model is a natural fit for structured hive/calorie data
- Official Docker image, easy pg_dump backups
- **ORM: Drizzle** — lightweight, type-safe, schema-as-code, great DX for TypeScript
- Migration tooling: Drizzle Kit (generate + apply migrations)

**Key tables (current):**

| Table               | Purpose                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `users`             | Platform accounts (Google OAuth, provisioned on first Hub login)                                          |
| `oauth_clients`     | OAuth 2.1 credentials for MCP clients                                                                     |
| `mcp_servers`       | Per-user enable/disable flags for each MCP sub-server                                                     |
| `calorie_profiles`  | Dietary profile: age, sex, activity level, calorie goal override                                          |
| `meal_logs`         | Time-stamped meal entries with kcal and macros                                                            |
| `measurement_types` | Lookup: key, label, unit (e.g. `weight`/`Weight`/`kg`)                                                    |
| `body_measurements` | Time-series body measurements (weight, height, waist, etc.) per user                                      |
| `hive_logs`         | Beekeeping inspection/treatment/feeding events                                                            |
| `hives`             | Hive registry                                                                                             |
| `hive_todos`        | Task list scoped to a hive                                                                                |
| `trips` + `trip_*`  | Travel domain tables for reservations, places, checklist, companions, and documents                       |
| `api_request_logs`  | HTTP request/response audit log (`service`=app, `server`=MCP sub-server) with trigram-indexed error field |

---

### MCP Server Layer (Fastify)

- Replace Cloudflare Worker HTTP layer with a Fastify app
- Expose MCP over HTTP (SSE or Streamable HTTP — MCP SDK supports both)
- Endpoint pattern: `/api/<domain>/mcp` (for example: `/api/calories/mcp`, `/api/todo/mcp`, `/api/apiary/mcp`, `/api/travel/mcp`)
- OAuth 2.0 stays — adapt existing implementation from `src/http/`
- Each MCP sub-server remains its own module (calories, todo, apiary, travel, ...)
- Future MCPs are added as new modules without touching infrastructure

---

### Admin Panel (Next.js)

Personal cabinet with the following sections:

- **Main Dashboard** (`/`) — overview: today's calorie stats, quick links to feature dashboards and admin tools
- **Calories Dashboard** (`/calories`) — calorie profile, today's meals (add/delete), body measurements (log/delete)
- **Profile** (`/profile`) — display name, account info, per-feature data deletion, sign out
- **OAuth Clients** — create/revoke OAuth credentials for MCP clients
- **MCP Control** — enable/disable individual MCP servers per user
- **Data Explorer** — query and edit records (hive logs, meals, profiles, todos)
  - Initially: raw table views with basic CRUD
  - Later: domain-specific views (apiary timeline, calorie charts, etc.)

Auth: Google OAuth via NextAuth.js (single-user / small invite group). Users are automatically provisioned in the `users` table on first sign-in.
Protected Hub API routes in `packages/hub/src/app/api/**` use a shared auth route-wrapper that resolves the DB user from NextAuth session context (short-lived in-process cache for lookup efficiency).

---

### Reverse Proxy (Traefik)

Traefik handles all ingress:

- Auto-discovers containers via Docker labels (zero manual config per service)
- Built-in Let's Encrypt / ACME for automatic TLS
- Dashboard for routing visibility

**Routing (`alexiuc.dev`):**

| Host                      | Target                 |
| ------------------------- | ---------------------- |
| `alexiuc.dev`             | Next.js (CV / landing) |
| `hub.alexiuc.dev`         | Next.js HUB Dashboard  |
| `mcp.alexiuc.dev`         | Fastify MCP server(s)  |
| `staging.hub.alexiuc.dev` | Staging Hub Dashboard  |
| `staging.mcp.alexiuc.dev` | Staging MCP server(s)  |

---

## Repository Strategy

**Decision needed** — see Open Questions.

**Preferred option: Monorepo** (restructure current repo)

```
/
├── packages/
│   ├── mcp-server/          # Fastify app + all MCP sub-servers
│   ├── hub/                 # Next.js admin panel
│   └── shared/              # Types, auth utils, DB schema (Drizzle)
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.staging.yml
│   ├── nginx/ or traefik/   # Proxy config
│   └── terraform/           # VPS provisioning (Hetzner provider)
├── .github/
│   └── workflows/           # CI + deployment pipelines
└── PLATFORM_REQUIREMENTS.md
```

npm workspaces (or pnpm workspaces) manage inter-package dependencies.

---

## Environments

| Environment | Purpose                     | Hosting                                  |
| ----------- | --------------------------- | ---------------------------------------- |
| local       | Development                 | Docker Compose local                     |
| staging     | Integration tests, pre-prod | Same Hetzner VPS, separate Compose stack |
| production  | Live use                    | Hetzner primary VPS                      |

---

## Deployment

**GitHub Actions** for automated CI/CD:

- `pull_request` → run unit tests, type-check, lint
- `push to staging` → build images, push to GHCR, deploy to staging env
- `push to main` → build images, push to GHCR, deploy to production

Manual deploy script (`deploy.sh`) as fallback / emergency option.

**Image registry:** GitHub Container Registry (GHCR) — free for public repos.

**Secrets management:**

- GitHub Secrets for CI/CD secrets (DB passwords, SSH keys, etc.)
- `.env` file on server for runtime secrets (not committed — gitignored)
- Terraform `terraform.tfvars` file for infra secrets (gitignored or private repo)

---

## Infrastructure as Code

**Terraform** for VPS provisioning:

- Hetzner Cloud provider (`hcloud`)
- Provisions: server, SSH keys, firewall rules, optionally floating IP
- Terraform state: local file (fine for personal) or Terraform Cloud free tier
- Config scripts: public in repo (generic, no secrets)
- `terraform.tfvars` with actual values: gitignored locally, stored separately

---

## Security

- All traffic over HTTPS (Let's Encrypt via Traefik/Certbot)
- MCP endpoints protected by existing OAuth 2.0
- Admin panel protected by session auth (NextAuth.js or custom JWT)
- PostgreSQL not exposed outside Docker network
- Firewall: only ports 80, 443, 22 open (Hetzner Cloud Firewall)
- SSH key-only access, no password auth

---

## Backup

- Daily `pg_dump` → compressed → upload to Hetzner Object Storage (S3-compatible, cheap)
- Retain last 14 daily backups
- Cron job inside `db` container or a dedicated `backup` container

---

## Domain

**`alexiuc.dev`** ✅ — registered on Cloudflare Registrar (~€12/year).

| Subdomain          | Purpose                 |
| ------------------ | ----------------------- |
| `alex.alexiuc.dev` | Personal CV / portfolio |
| `hub.alexiuc.dev`  | Next.js HUB panel       |
| `mcp.alexiuc.dev`  | Fastify MCP server(s)   |

DNS managed via Cloudflare — subdomains are free, TLS via Traefik + Let's Encrypt.

---

## Cost Estimate (Monthly)

| Item                         | Cost              |
| ---------------------------- | ----------------- |
| Hetzner CX32 (prod)          | ~€8/month         |
| Hetzner CAX11 (staging)      | — (same VM) ✅    |
| Hetzner Object Storage (opt) | ~€1/month (10 GB) |
| Domain `alexiuc.dev`         | ~€1/month         |
| GitHub Actions               | Free (public)     |
| **Total (minimal)**          | **~€9/month**     |
| **Total (with backups)**     | **~€10/month**    |

---

## Data Migration

The one-time migration from Google Sheets → PostgreSQL is complete. The Cloudflare Worker
implementation has been decommissioned. All data now lives in PostgreSQL on the Hetzner VPS.

---

## Decisions Log

| #   | Topic                      | Decision                                          |
| --- | -------------------------- | ------------------------------------------------- |
| 1   | Monorepo vs separate repos | Monorepo ✅                                       |
| 2   | Infra config location      | Public in this repo, secrets gitignored ✅        |
| 3   | Deployment trigger         | GitHub Actions ✅                                 |
| 4   | Staging environment        | Same VM as prod, separate Docker Compose stack ✅ |
| 5   | Database                   | PostgreSQL + Drizzle ORM ✅                       |
| 6   | Cost ceiling               | ~€9/month (minimal), ~€10/month (with backups) ✅ |
| 7   | Domain                     | `alexiuc.dev` ✅ registered on Cloudflare         |

---

## Planned MCP Servers

### Products Manager _(next)_

AI-assisted home inventory and shopping list management.

**Core concepts:**

| Concept             | Description                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Product catalog** | Known products: name, category, unit, preferred brand, usual store, default buy quantity, minimum stock level |
| **Home inventory**  | What is currently at home: product, quantity, location (fridge/pantry/freezer), expiry date                   |
| **Shopping list**   | Items to buy: product, quantity needed, priority, status (pending/bought)                                     |

**MCP Tools (proposed):**

_Inventory:_

- `products_inventory_get` — list all items at home, optionally filtered by category/location
- `products_inventory_update` — add or update stock (e.g. "I bought 2 bottles of olive oil")
- `products_inventory_consume` — reduce stock (e.g. "used the last of the pasta")
- `products_inventory_get_low_stock` — list items below their minimum stock level

_Shopping list:_

- `products_shopping_list_get` — get current shopping list
- `products_shopping_list_add` — add item to shopping list
- `products_shopping_list_mark_bought` — mark item as bought (optionally updates inventory)
- `products_shopping_list_clear` — clear bought items from list
- `products_shopping_suggest` — AI-callable: suggest what to buy based on low stock + shopping list

_Catalog:_

- `products_catalog_add` — add a new product to the catalog
- `products_catalog_get` — look up a product's details
- `products_catalog_list` — list all known products (filterable by category)
- `products_catalog_update` — update product details (min stock, preferred brand, etc.)

**DB Schema (PostgreSQL):**

```
products_catalog (id, name, category, unit, preferred_brand, usual_store, min_stock_qty, default_buy_qty, notes)
products_inventory (id, product_id FK, quantity, location, expiry_date, updated_at)
products_shopping_list (id, product_id FK, quantity, priority, notes, status, added_at, bought_at)
```

**Key AI interaction flows:**

- "What do I need to buy?" → `products_inventory_get_low_stock` + `products_shopping_list_get`
- "I went shopping, I bought X, Y, Z" → `products_shopping_list_mark_bought` per item → inventory updated
- "Do I have enough olive oil for this week?" → `products_inventory_get` for olive oil
- "Add pasta to my shopping list" → `products_shopping_list_add`
- "Generate a shopping list for me" → `products_shopping_suggest` based on low stock

**Admin panel view (future):**

- Inventory table with inline quantity editing
- Shopping list with check-off UI
- Product catalog management

---

## Future Considerations (Out of Scope for Now)

- Nicer domain-specific views (apiary timeline, calorie charts/graphs)
- Multiple user accounts (currently single user / small invite group)
- Mobile-friendly admin panel
- Notification system (e.g., hive inspection reminders, low stock alerts)
- Barcode scanning integration for inventory updates (mobile)
