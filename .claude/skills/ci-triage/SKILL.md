---
name: ci-triage
description: |
  Use when CI is red or being watched on a my-hub PR — "CI failed", "E2E is red", "why did the check fail",
  "babysit/watch the PR", a check_run/check_suite failure event. Maps the workflows, fetches only the failing part
  of the logs, separates this PR's failures from staging flakes, and reproduces locally.
metadata:
  scope: monorepo
  stage: verification
---

# CI triage

## What runs

| Workflow (file)       | When         | Jobs / steps that fail in practice                                                                                                                                                                      |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI (`ci.yml`)         | PR + push    | `lint-typecheck-test`: `pnpm turbo run typecheck lint test:unit`, then `gen:palettes:check`                                                                                                             |
| E2E Tests (`e2e.yml`) | PRs only     | `build-and-push` (bake staging images) → E2E job: deploy staging stack, provision user, **Run E2E tests** (`pnpm test:e2e` = MCP vitest suites **and** Hub Playwright, against `staging.*.alexiuc.dev`) |
| Deploy (`deploy.yml`) | push to main | bake prod images → SSH deploy                                                                                                                                                                           |

E2E never runs on `main`, so there is no main baseline: compare with the latest E2E runs of other PRs instead.
The E2E job (`E2EExpected`) shares one staging stack (`concurrency: staging-stack`): with three PRs in flight the
middle one's pending job is **cancelled**, not failed — just re-run it.

## Get the failure cheaply

1. `mcp__github__pull_request_read` `method: get_check_runs` → failing check + job id.
2. CI job: reproduce locally first — `pnpm exec turbo run typecheck lint test:unit --output-logs=errors-only` (and
   `pnpm --filter @my-hub/hub gen:palettes:check`) usually shows the same error faster than reading the log.
3. E2E job: hand it to the **`ci-investigator`** agent (job id + PR number + what the PR changes). It pulls the log
   with `mcp__github__get_job_logs` (`return_content: true`, `tail_lines` ≤ 400 first), greps the failure blocks and
   returns ~15 lines. Don't load a 1,500-line E2E log into the main context. `gh api …/logs` doesn't work here (the
   blob-storage redirect is blocked); `gh api` for runs/check-runs metadata does.

## Decide whose failure it is

- **This PR's** if the failing test exercises code or copy the diff touches, or it reproduces locally
  (`e2e-tests` skill: run that spec / suite). Fix, re-verify, push.
- **Known staging flakes** — one MCP tool call timing out at 30 s on staging while the rest of the file takes ~1 s
  (seen in `calories-profile.e2e.ts`, `finances.e2e.ts`); infra steps dying before any test ran. Re-run once:
  `mcp__github__actions_run_trigger` `method: rerun_failed_jobs`. A second identical failure is real.
- **Date-sensitive specs** (`vacation.spec.ts` broke on Sundays and on month-specific copy): check the run date
  against the assertion before blaming the diff.
- **Broken on every PR** (same test red in other PRs' recent runs): look for an open fix PR/branch
  (`git ls-remote origin 'refs/heads/claude/*'`), cherry-pick its change into this PR, and say so in one PR comment.
  If none exists, fix it in a separate branch/session unless the user wants it here.

## Watching a PR without burning context

- Long babysitting sessions get expensive (one multi-currency PR session passed $50 and hit compaction). On each
  wake: one `get_check_runs` call, act, stop. Don't re-read diffs or logs you already summarised.
- Safety-net check-ins via `send_later` with a self-contained message (PR number, head SHA, what you're waiting for).
