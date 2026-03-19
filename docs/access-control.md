# Repository Access Control

## Public repository — what anyone can do

Because this is a **public** GitHub repository:

| Action | Anyone (no account) | GitHub user (no collaborator role) | Collaborator / Admin |
|--------|--------------------|------------------------------------|----------------------|
| Read code | ✅ | ✅ | ✅ |
| Fork the repository | ✅ | ✅ | ✅ |
| Open a pull request from a fork | — | ✅ | ✅ |
| Push a branch directly | ❌ | ❌ | ✅ |
| Merge a pull request | ❌ | ❌ | ✅ (subject to protection rules below) |
| Trigger `workflow_dispatch` manually | ❌ | ❌ | ✅ |
| Deploy to production | ❌ | ❌ | ✅ (see environment guard below) |

## CODEOWNERS

`.github/CODEOWNERS` assigns `@alexalexiuc` as the required reviewer for every file.
With branch protection (see below), **no pull request can be merged without an approved review from the owner**, even by other collaborators.

## Branch protection rules (must be configured in GitHub → Settings → Branches)

Apply the following ruleset to both the `main` and `staging` branches:

| Setting | Value |
|---------|-------|
| Require a pull request before merging | ✅ enabled |
| Required approvals | 1 |
| Dismiss stale pull request approvals when new commits are pushed | ✅ enabled |
| Require review from Code Owners | ✅ enabled |
| Require status checks to pass before merging | ✅ enabled |
| Required status checks | `Lint / Type-check / Test` (from `ci.yml`) |
| Require branches to be up to date before merging | ✅ enabled |
| Do not allow bypassing the above settings | ✅ enabled (applies to admins too) |
| Restrict who can push to matching branches | ✅ enabled — allow only `@alexalexiuc` |
| Allow force pushes | ❌ disabled |
| Allow deletions | ❌ disabled |

> **Why both `main` and `staging`?**  
> `deploy.yml` deploys production on every push to `main`; `e2e.yml` deploys staging on every push to `staging`. Protecting both prevents accidental or unauthorised deployments.

## CI workflow (`ci.yml`)

Runs `lint`, `typecheck`, and `test` on:
- Every **pull request** targeting `main` or `staging`
- Every **direct push** to `main` or `staging`

Running CI on direct pushes ensures the status check is always present on the branch tip, satisfying the required-status-checks rule even if a commit lands outside a PR flow.

## Deployment guard (`deploy.yml`)

The `deploy` job uses `environment: production`. In GitHub Settings → Environments → production, configure:

| Setting | Value |
|---------|-------|
| Required reviewers | `@alexalexiuc` |
| Prevent self-review | ✅ enabled (if the owner is also the committer) |

This means that even if a push to `main` somehow bypasses branch protection, the production **deploy itself requires a manual approval** from the owner before the SSH deploy step executes.

## Summary

With the above controls in place:

- **Fork + PR**: anyone can do this; PRs from forks run CI in an isolated, read-only context (no secrets).
- **Merging**: requires (a) passing CI, (b) an approved review from `@alexalexiuc`, (c) no outstanding stale reviews.
- **Deploying to production**: requires (a) a merge to `main`, then (b) manual approval of the `production` environment.
- **Direct push to `main`/`staging`**: blocked by branch protection.
