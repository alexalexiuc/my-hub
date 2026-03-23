# Requirements Documentation

This folder contains feature-level requirements for the my-hub platform. It is organised
into subfolders that mirror deployable layers and cross-cutting platform features.

## Subfolders

### `mcps/`

Requirements for individual MCP (Model Context Protocol) servers — the backend tools
exposed to AI clients such as Claude. Each file describes one MCP sub-server: its
purpose, the tools it provides, its data model, and any constraints.

Examples: Apiary, Calorie Tracker, Products Manager.

### `hub/`

Requirements for the Hub Dashboard webapp — the Next.js UI served at `hub.alexiuc.dev`.
Each file describes one functional area of the Hub Dashboard panel: OAuth client management,
data explorer, user settings, etc.

### `platform/`

Requirements for cross-cutting platform capabilities that span multiple packages or
services (for example, shared logging, observability, auth foundations, and infra
contracts used by both Hub and MCP services).

---

## File Naming Convention

All requirement files use the prefix `feature-` followed by a short kebab-case name:

```
feature-<name>.md
```

Examples:

- `mcps/feature-hive-manager.md`
- `mcps/feature-calorie-tracker.md`
- `hub/feature-oauth-clients.md`
- `hub/feature-data-explorer.md`
- `platform/feature-api-request-logging.md`

Use `_template.md` (in this folder) as the starting point for every new file.

---

## Status Values

Each feature document carries a `status` field in its header:

| Status        | Meaning                                          |
| ------------- | ------------------------------------------------ |
| `draft`       | Idea captured; requirements not yet validated    |
| `in-progress` | Actively being designed or developed             |
| `implemented` | Feature is live in production (may still evolve) |

---

## Priority Values

| Priority | Meaning                                                 |
| -------- | ------------------------------------------------------- |
| `high`   | Blocking or on the critical path for the next milestone |
| `medium` | Important but not immediately blocking                  |
| `low`    | Nice-to-have; deferred to a later iteration             |

---

## Requirement Numbering: FR-xx / TR-xx

Every requirement inside a document is assigned a stable identifier:

- **FR-xx** — Functional Requirement. Describes _what_ the system must do from a
  user or AI-client perspective (behaviour, capability, data contract).
- **TR-xx** — Technical Requirement. Describes _how_ the system must behave at the
  implementation level (performance, security, infrastructure, coding constraints).

Numbers are scoped to the file and start at `01`. Once assigned, an ID must never
be reused or renumbered — even if the requirement is removed. This keeps commit
history and external references stable, and lets AI models reason about requirements
by ID across conversations.

---

## Intended Audience

These documents are written to be readable by both humans and AI models (Claude and
others). Consistent structure, explicit IDs, and plain language are intentional — they
make it possible for an AI agent to:

- Understand the full scope of a feature from a single file
- Trace from a requirement to its implementation in the codebase
- Check whether a proposed change satisfies or violates a stated requirement
- Generate or update code that stays within the documented constraints
