# Claude Code Guidelines

**Always read the relevant `CLAUDE.md` files before making any changes.** The root `CLAUDE.md` and relevant package `CLAUDE.md` files contain the authoritative conventions for package boundaries, component location, naming, exports, and barrel files. Follow them strictly for all code changes in this repo.

**Use skills before implementing manually.** Key skills for this repo:

- New feature area end to end (tables → services → MCP → Hub page) → `/add-feature-module`
- New MCP sub-server / domain endpoint → `/mcp-add-server` (then tools via `/mcp-task-tools` + `/mcp-add-tool`)
- Adding an MCP tool → use `/mcp-add-tool` skill (see also root `CLAUDE.md` §MCP tool design rules)
- Looking at the Hub UI (running the app, screenshots, verifying a page renders) → use `/ui-sandbox` skill
- Checking work before reporting it done or committing → `/verify`
- Package-level facts (build order, extension points, display paths) → read the `CLAUDE.md` in the relevant package directory
