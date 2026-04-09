# Claude Code Guidelines

**Always read `AGENTS.md` before making any changes.** This file (at the repo root and in relevant packages) contains the authoritative conventions for component location, naming, exports, and barrel files. Follow it strictly for all code changes in this repo.

**Use skills before implementing manually.** Key skills for this repo:

- Adding an MCP tool → use `/mcp-add-tool` skill (see also root `AGENTS.md` §MCP tool design rules)
- Package-level facts (build order, extension points, display paths) → read the `CLAUDE.md` in the relevant package directory
