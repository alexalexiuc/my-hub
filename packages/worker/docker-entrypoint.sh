#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
cd /app/packages/shared
pnpm db:migrate
echo "[entrypoint] Migrations complete."

echo "[entrypoint] Starting worker..."
cd /app
exec node packages/worker/dist/index.js
