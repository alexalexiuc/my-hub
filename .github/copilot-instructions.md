# Copilot Instructions

- Project rules: root [`CLAUDE.md`](../CLAUDE.md) plus the `CLAUDE.md` in the package you touch
  (`packages/hub`, `packages/shared`, `packages/mcp-server`, `packages/e2e`). Follow them for all code changes.
- Reviews: use [`REVIEW.md`](../REVIEW.md) — the repo-specific checklist and its list of known false positives
  (e.g. `z.enum(ConstObject)` is valid in Zod v4; don't suggest `z.nativeEnum`).
- MCP tool design and implementation: `.claude/skills/mcp-tool/SKILL.md`. Domain rules (finances money model,
  travel bookings, calories goals, vacation engine): `.claude/skills/<domain>-domain/SKILL.md`.
- Feature specs: `docs/requirements/<area>/feature-<name>.md` — read before changing a feature, update `Status`
  and acceptance criteria after.
