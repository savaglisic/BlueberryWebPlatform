#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_PORT="${BLUEBERRY_DEV_PORT:-5173}"
RUNTIME_DIR="${SCRIPT_DIR}/.wrangler"
PID_FILE="${RUNTIME_DIR}/dev-server.pid"
LOG_FILE="${RUNTIME_DIR}/dev-server.log"

managed_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(<"$PID_FILE")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  [[ "$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)" == "$SCRIPT_DIR" ]] || return 1
  printf '%s\n' "$pid"
}

stop_server() {
  local pid
  if ! pid="$(managed_pid)"; then
    rm -f "$PID_FILE"
    echo "Blueberry development server is not running."
    return 0
  fi

  kill -TERM -- "-${pid}" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  for _ in {1..40}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Stopped Blueberry development server (PID ${pid})."
      return 0
    fi
    sleep 0.1
  done
  kill -KILL -- "-${pid}" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Stopped Blueberry development server (PID ${pid})."
}

start_server() {
  mkdir -p "$RUNTIME_DIR"
  local pid
  if pid="$(managed_pid)"; then
    echo "Blueberry development server is already running (PID ${pid})."
    echo "Local:   http://127.0.0.1:${DEV_PORT}"
    echo "Preview: https://preview.glisic.net"
    return 0
  fi
  rm -f "$PID_FILE"

  if ss -ltn "sport = :${DEV_PORT}" 2>/dev/null | tail -n +2 | grep -q .; then
    echo "Port ${DEV_PORT} is already in use by an unmanaged process." >&2
    exit 1
  fi

  : >"$LOG_FILE"
  (
    cd "$SCRIPT_DIR"
    exec setsid env BLUEBERRY_DEV_PORT="$DEV_PORT" npm run dev </dev/null >>"$LOG_FILE" 2>&1
  ) &
  pid=$!
  printf '%s\n' "$pid" >"$PID_FILE"

  for _ in {1..100}; do
    if curl --silent --fail --output /dev/null "http://127.0.0.1:${DEV_PORT}/"; then
      echo "Started Blueberry development server (PID ${pid})."
      echo "Local:   http://127.0.0.1:${DEV_PORT}"
      echo "Preview: https://preview.glisic.net"
      echo "Logs:    ./dev.sh logs"
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Development server failed to start. Recent log output:" >&2
      tail -n 40 "$LOG_FILE" >&2
      exit 1
    fi
    sleep 0.1
  done

  echo "Development server did not become ready. See ${LOG_FILE}." >&2
  stop_server
  exit 1
}

seed_database() {
  mkdir -p "$RUNTIME_DIR/snapshots" "$RUNTIME_DIR/backups"
  if ! command -v sqlite3 >/dev/null; then
    echo "sqlite3 is required to validate the local D1 seed." >&2
    exit 1
  fi
  local timestamp export_temp seed_root seed_db current_d1 backup_d1 row_count table_count table table_rows
  local was_running=0
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  export_temp="${RUNTIME_DIR}/snapshots/production-${timestamp}.sql.tmp"
  seed_root="${RUNTIME_DIR}/seed-${timestamp}"
  current_d1="${RUNTIME_DIR}/state/v3/d1"
  backup_d1="${RUNTIME_DIR}/backups/d1-${timestamp}"

  if managed_pid >/dev/null; then
    was_running=1
  fi

  echo "Exporting production D1 (read-only; this consumes no D1 row writes)..."
  (
    cd "$SCRIPT_DIR"
    npx wrangler d1 export blueberry-web --remote --output "$export_temp" --skip-confirmation
    npx wrangler d1 execute blueberry-web --local --persist-to "$seed_root" --file "$export_temp" --yes >"${RUNTIME_DIR}/seed-import.log"
    npx wrangler d1 migrations apply blueberry-web --local --persist-to "$seed_root"
  )

  seed_db="$(find "$seed_root" -type f -name '*.sqlite' ! -name 'metadata.sqlite' -print -quit)"
  if [[ -z "$seed_db" ]]; then
    echo "Wrangler did not create a local SQLite database." >&2
    exit 1
  fi
  table_count="$(sqlite3 "$seed_db" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations';")"
  row_count=0
  while IFS= read -r table; do
    table_rows="$(sqlite3 "$seed_db" "SELECT count(*) FROM \"${table//\"/\"\"}\";")"
    row_count=$((row_count + table_rows))
  done < <(sqlite3 "$seed_db" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name;")
  if [[ -z "$table_count" || "$table_count" -lt 1 || -z "$row_count" ]]; then
    echo "The exported database failed validation; existing local state was left untouched." >&2
    exit 1
  fi

  if (( was_running )); then
    stop_server
  fi
  if [[ -d "$current_d1" ]]; then
    mv "$current_d1" "$backup_d1"
    echo "Previous local D1 state: ${backup_d1#$SCRIPT_DIR/}"
  fi
  mkdir -p "$(dirname "$current_d1")"
  mv "${seed_root}/v3/d1" "$current_d1"
  mv "$export_temp" "${RUNTIME_DIR}/snapshots/production.sql"
  rm -rf "$seed_root"

  echo "Seeded local D1 with ${table_count} application tables and ${row_count} application rows."
  echo "Snapshot: .wrangler/snapshots/production.sql"
  if (( was_running )); then
    start_server
  fi
}

case "${1:-start}" in
  start) start_server ;;
  stop) stop_server ;;
  status)
    if pid="$(managed_pid)"; then
      echo "Blueberry development server is running (PID ${pid}) on port ${DEV_PORT}."
    else
      rm -f "$PID_FILE"
      echo "Blueberry development server is not running."
      exit 1
    fi
    ;;
  logs)
    touch "$LOG_FILE"
    exec tail -n 100 -f "$LOG_FILE"
    ;;
  seed-db) seed_database ;;
  migrate|--migrate)
    cd "$SCRIPT_DIR"
    exec npm run db:migrate:local
    ;;
  *)
    echo "Usage: ./dev.sh [start|stop|status|logs|seed-db|migrate]" >&2
    exit 2
    ;;
esac
