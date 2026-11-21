#!/bin/sh
set -e

# Only run migrations and seed if this is the API service (not the worker)
if [ "$1" = "node" ] && echo "$@" | grep -q "server"; then
  echo "[CertiFlow Entrypoint] Running Prisma migrations..."
  npx prisma migrate deploy --schema /app/prisma/schema.prisma || npx prisma db push --schema /app/prisma/schema.prisma --skip-generate

  echo "[CertiFlow Entrypoint] Running idempotent database seed..."
  node dist/prisma/seed.js 2>/dev/null || echo "[CertiFlow Entrypoint] Seed step skipped (may need tsx)."
fi

echo "[CertiFlow Entrypoint] Starting service: $@"
exec "$@"
