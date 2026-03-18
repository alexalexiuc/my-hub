# Copilot Instructions

Use [AGENTS.md](....\AGENTS.md) as the canonical project guidance.

## Copilot-specific notes

- Prefer small, package-scoped changes.
- Follow the package boundaries and change order defined in `AGENTS.md`.
- Before working on a feature, read the corresponding `docs/requirements/<area>/feature-<name>.md` file for requirements and constraints.
- After implementing or modifying a feature, update the requirement doc: set the `Status` field and check off completed acceptance criteria.
- When architectural facts change (package names, services, routing), update `PLATFORM_REQUIREMENTS.md` to reflect the current state.
