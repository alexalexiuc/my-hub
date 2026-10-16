---
name: review-pr
description: |
  Use when asked to review a my-hub pull request or diff — "review PR #N", "look at this PR", "is this ready to
  merge", "review my changes". Fetches the PR without flooding context, reviews it against REVIEW.md with the
  repo-reviewer agent, checks CI, and reports or posts findings.
metadata:
  scope: monorepo
  stage: review
---

# Reviewing a PR

1. **Metadata:** `mcp__github__pull_request_read` `method: get` (title, author, base) and `get_check_runs`.
   Skip `get_files` / `get_diff` — they are huge; use git.
2. **Fetch locally:** `git fetch -q origin pull/<N>/head:pr<N> main && B=$(git merge-base origin/main pr<N>)`, then
   `git diff --stat $B pr<N>` to see the shape. Save the full diff to a file instead of printing it:
   `git diff $B pr<N> > "$SCRATCH/pr<N>.diff"`.
3. **Review:** for anything beyond a few files, spawn the **`repo-reviewer`** agent with the PR number, the diff
   file path and one line on the PR's intent; for large PRs one agent per package (shared / mcp-server / hub /
   e2e). Read only the hunks its findings point to, and confirm each finding against the code before reporting.
4. **Run what's cheap:** `git checkout pr<N>` (or a worktree) and the `verify` command if CI hasn't already
   covered it; for UI PRs take screenshots with `ui-sandbox`.
5. **Report** findings ranked by severity with `file:line`, a one-line failure scenario each, and what CI says.
   Post on GitHub only when asked (`pull_request_review_write` create → `add_comment_to_pending_review` →
   `submit_pending`).

The built-in `/code-review` also works on the current diff; REVIEW.md feeds the repo-specific part of both.
