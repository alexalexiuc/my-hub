#!/bin/bash
# SessionStart hook. Its stdout becomes context for the session, so setup output goes to stderr and stdout
# carries only the index of existing helpers (printed in every session, local or cloud).
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  {
    # The container's global pnpm (v10) self-switches to the `packageManager` version (pnpm 12) and installs it
    # with lifecycle scripts blocked, so its `pnpm` bin stays the shebang-less placeholder instead of the native
    # binary. A shell still runs it, but turbo spawns `pnpm` directly and fails with "Exec format error (os error
    # 8)" — breaking `pnpm typecheck`, `pnpm lint` and the husky pre-push hook. Running the package's own
    # preinstall (`install.js`) links the native binary over the placeholder.
    # `pnpm exec` puts the self-switched pnpm first on PATH; resolve the real file behind it.
    pnpm_bin="$(readlink -f "$(pnpm exec sh -c 'command -v pnpm')")"
    if [ "$(head -c 4 "$pnpm_bin" | od -An -c | tr -d ' ')" != '177ELF' ]; then
      (cd "$(dirname "$pnpm_bin")" && node install.js)
      echo "[session-start] linked native pnpm binary at $pnpm_bin"
    fi

    pnpm install --frozen-lockfile

    # hub/mcp-server/worker compile against packages/shared/dist, which a fresh clone lacks: without it the first
    # `pnpm --filter <pkg> typecheck` or vitest run fails with errors that look like real bugs.
    if [ ! -d packages/shared/dist/services ]; then
      pnpm --filter @my-hub/shared build >/dev/null
      echo "[session-start] built packages/shared/dist"
    fi
  } >&2

  # ANSI colour codes in turbo/vitest/playwright output are pure token overhead for an agent.
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo 'export NO_COLOR=1 FORCE_COLOR=0' >> "$CLAUDE_ENV_FILE"
  fi
fi

# Generated from the code on every start, so it never goes stale. Keeps agents from re-creating helpers that
# already exist (they used to: three copies of shiftDateStr). check-duplicate-helpers.mjs backs it up per edit.
echo "Existing helpers — reuse these instead of writing new ones (signatures + docs: pnpm inventory <dir> --docs)."
echo "@my-hub/shared/utils (packages/shared/src/utils/):"
node infra/scripts/inventory.mjs packages/shared/src/utils --brief | sed 's/^/  /'
echo "hub @/lib/utils and @/hooks (packages/hub/src/lib/utils/, packages/hub/src/hooks/):"
node infra/scripts/inventory.mjs packages/hub/src/lib/utils packages/hub/src/hooks --brief |
  sed -e 's#^packages/hub/src/lib/utils/#  lib/utils/#' -e 's#^packages/hub/src/hooks/#  hooks/#'
echo "A general-purpose helper that is missing belongs in packages/shared/src/utils/, not next to its first caller."
