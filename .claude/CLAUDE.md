# Claude Code Guidelines

**Always read the relevant `CLAUDE.md` files before making any changes.** The root `CLAUDE.md` and relevant package `CLAUDE.md` files contain the authoritative conventions for package boundaries, component location, naming, exports, and barrel files. Follow them strictly for all code changes in this repo.

**Use skills before implementing manually.** Key skills for this repo:

- Adding an MCP tool → use `/mcp-add-tool` skill (see also root `CLAUDE.md` §MCP tool design rules)
- Package-level facts (build order, extension points, display paths) → read the `CLAUDE.md` in the relevant package directory
