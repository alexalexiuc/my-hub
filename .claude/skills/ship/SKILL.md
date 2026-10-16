---
name: ship
description: |
  Use when a change is ready to hand over: "commit", "push", "open a PR", "wrap up", "we're done". Updates the
  requirement docs, commits with the repo's message style, pushes, and opens or updates the PR. Run the verify
  skill first.
metadata:
  scope: monorepo
  stage: delivery
---

# Ship a change

## 1. Docs (part of the change, not a follow-up)

- Feature spec `docs/requirements/<hub|mcps|platform>/feature-<name>.md`: set `Status` (`in-progress` /
  `implemented`), tick satisfied acceptance criteria `[x]`, add an FR/TR row for any new behaviour. Rows are long
  single-line table cells — edit them with the Edit tool on a unique substring, not `sed` line numbers.
- New feature area → new spec from `docs/requirements/_template.md`.
- Architecture facts changed (packages, services, routing, deploy, sub-server list) → `PLATFORM_REQUIREMENTS.md`
  (it describes today, not the plan). MCP tool list changed → README tool table if the domain is listed.
- A rule a future session would otherwise re-learn → the relevant `CLAUDE.md` (only if it applies to every edit
  there) or skill (everything else). Keep CLAUDE.md files short.
- `pnpm exec prettier --write <the docs you touched>`.

## 2. Commit

- Check `git status --short`: no screenshots, `test-results/`, `.auth/`, scratch scripts or `shots/` staged.
- Conventional commit: `feat(finances): …`, `fix(hub): …`, `chore(claude): …`, `refactor(mcp-server): …`. Subject
  says what changed for the user; body says why and anything a reviewer must know (migrations, data changes).
- Generated migration in the diff → say so in the body; destructive ones (drops) in capitals in the PR too.
- Hooks: pre-commit runs lint-staged, pre-push runs `pnpm typecheck` + `pnpm test:unit`. If they fail with an
  environment error, fix the environment (see root `CLAUDE.md` gotchas) — never `--no-verify`.

## 3. Push and PR

- `git push -u origin <branch>` (retry network failures with backoff; never push to another branch unasked).
- Open a PR only when asked. No PR template exists; use:

  ```
  ## Summary
  <what changed for the user, 2–5 bullets; call out migrations / data deletion>

  ## Testing
  <checks run with counts, specs run locally, screenshots taken, what was NOT run and why>
  ```

- A PR you opened is yours until green: offer to watch it; on red CI use the `ci-triage` skill.
- Merged PR + follow-up work → new branch state from `main`, new PR. Never stack on merged history.
