#!/usr/bin/env bash
set -e

# ---------------------------------------------------------------------------
# Standalone commands (handled before passing through to docker compose)
# ---------------------------------------------------------------------------

case "$1" in
  --alembic)
    # Generate a new Alembic migration inside the running backend container.
    # Files are written as root inside the container, so we chown them back
    # to the current local user so git/editors don't need sudo.
    shift
    MSG="${*:-auto}"
    CONTAINER=$(docker compose -f docker-compose.yml -f docker-compose.dev.yml ps -q backend)
    if [ -z "$CONTAINER" ]; then
      echo "Backend container is not running. Start it first with: ./dev.sh up -d"
      exit 1
    fi
    docker exec "$CONTAINER" flask db migrate -m "$MSG"
    # Fix ownership so the generated file is owned by the local user, not root
    docker exec "$CONTAINER" chown -R "$(id -u):$(id -g)" /app/migrations/versions 2>/dev/null || true
    echo "Migration created. Review it in backend/migrations/versions/ before committing."
    exit 0
    ;;

  --migrate)
    # Apply pending Alembic migrations against the local dev database.
    CONTAINER=$(docker compose -f docker-compose.yml -f docker-compose.dev.yml ps -q backend)
    if [ -z "$CONTAINER" ]; then
      echo "Backend container is not running. Start it first with: ./dev.sh up -d"
      exit 1
    fi
    docker exec "$CONTAINER" flask db upgrade
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Default: pass all arguments straight through to docker compose
# ---------------------------------------------------------------------------
docker compose -f docker-compose.yml -f docker-compose.dev.yml "$@"
