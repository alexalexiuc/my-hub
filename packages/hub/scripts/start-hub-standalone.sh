#!/usr/bin/env bash
# Builds and starts the hub in standalone/production mode (same as Docker prod).
# Loads env vars from .env at the repo root.
#
# Usage: ./scripts/start-hub-standalone.sh [--skip-build]
#
# Flags:
#   --skip-build   Skip the pnpm build step (use when the build is already fresh)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# Load .env from repo root
ENV_FILE="$REPO_ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Create it before running this script." >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ "$SKIP_BUILD" == false ]]; then
  echo ">>> Building @my-hub/shared …"
  pnpm --filter @my-hub/shared build

  echo ">>> Building @my-hub/hub …"
  pnpm --filter @my-hub/hub build
fi

# Mirror the Docker COPY steps: copy static assets into the standalone output
# directory so the standalone server can serve them (they are not included in
# the standalone bundle by Next.js).
STANDALONE="$REPO_ROOT/packages/hub/.next/standalone"
echo ">>> Copying static assets into standalone output …"
cp -r "$REPO_ROOT/packages/hub/.next/static" "$STANDALONE/packages/hub/.next/static"
cp -r "$REPO_ROOT/packages/hub/public/." "$STANDALONE/packages/hub/public/"

SERVER="$REPO_ROOT/packages/hub/.next/standalone/packages/hub/server.js"
if [[ ! -f "$SERVER" ]]; then
  echo "ERROR: Standalone server not found at $SERVER" >&2
  echo "Run without --skip-build or run the build manually first." >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="0.0.0.0"

echo ">>> Starting hub standalone server on http://localhost:$PORT"
exec node "$SERVER"
