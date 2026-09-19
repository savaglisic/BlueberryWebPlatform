#!/usr/bin/env bash
set -euo pipefail

# Cloudflare-native development with isolated local D1 and R2 bindings.
case "${1:-}" in
  --migrate)
    exec npm run db:migrate:local
    ;;
esac

DEV_PORT="${BLUEBERRY_DEV_PORT:-5173}"

if ss -ltn "sport = :${DEV_PORT}" 2>/dev/null | tail -n +2 | grep -q .; then
  echo "Port ${DEV_PORT} is already in use; choose BLUEBERRY_DEV_PORT explicitly." >&2
  exit 1
fi

exec npm run dev
