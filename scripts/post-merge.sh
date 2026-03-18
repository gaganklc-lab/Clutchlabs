#!/bin/bash
set -e

# Post-merge setup script
# Runs automatically after task branches are merged.
# Must be idempotent and non-interactive (stdin is closed).

echo "[post-merge] Installing npm dependencies..."
npm install --legacy-peer-deps

echo "[post-merge] Running database migrations (if any)..."
# Only run db:push if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  npm run db:push -- --force 2>/dev/null || echo "[post-merge] db:push skipped or failed (non-fatal)"
fi

echo "[post-merge] Done."
