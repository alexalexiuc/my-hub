# Copilot Instructions

Read `CLAUDE.md` files for project guidance — the root [`CLAUDE.md`](../CLAUDE.md) covers project-wide rules, and each package has its own `CLAUDE.md` (e.g. `packages/hub/CLAUDE.md`, `packages/shared/CLAUDE.md`, `packages/mcp-server/CLAUDE.md`) with package-specific conventions. Follow them for all code changes.

## Key guidelines

- Prefer small, package-scoped changes.
- Follow the package boundaries and change order defined in the root `CLAUDE.md`.
- For MCP server work, design task-oriented tools first (natural-language user intents) and avoid exposing redundant CRUD-only tools when Hub already provides full CRUD flows.
- Start MCP tool design with `.claude/skills/mcp-task-tools/SKILL.md`, then implement with `.claude/skills/mcp-add-tool/SKILL.md` or `.claude/skills/mcp-add-resource/SKILL.md`.
- Before working on a feature, read the corresponding `docs/requirements/<area>/feature-<name>.md` file for requirements and constraints.
- After implementing or modifying a feature, update the requirement doc: set the `Status` field and check off completed acceptance criteria.
- When architectural facts change (package names, services, routing), update `PLATFORM_REQUIREMENTS.md` to reflect the current state.

## Zod enum review rule

- This repository uses Zod v4 (`zod@^4.3.6`). In this version, `z.enum(...)` accepts enum-like objects (`as const` objects) in addition to tuple literals.
- Treat `z.enum(TransactionTypes)` and similar patterns as valid when `TransactionTypes` is a `const` object map.
- Do not suggest replacing `z.enum(TransactionTypes)` with `z.nativeEnum(...)` in this codebase.
- During PR reviews, only flag enum schema usage if there is an actual type/runtime mismatch, not because an enum-like object is passed to `z.enum`.
