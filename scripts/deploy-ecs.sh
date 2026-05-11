#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-main}"
BACKEND_SERVICE="${BACKEND_SERVICE:-hit-agent-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-hit-agent-frontend}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8000/api/health}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:3000}"
BACKEND_VENV_PYTHON="${BACKEND_VENV_PYTHON:-$ROOT_DIR/backend/.venv/bin/python}"
BACKEND_VENV_PIP="${BACKEND_VENV_PIP:-$ROOT_DIR/backend/.venv/bin/pip}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/hit-agent/deploy-state}"

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempts="${3:-30}"
  local sleep_seconds="${4:-2}"

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name is ready: $url"
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "$name failed health check: $url" >&2
  return 1
}

hash_file() {
  sha256sum "$1" | awk '{print $1}'
}

should_refresh() {
  local source_file="$1"
  local stamp_file="$2"
  local current_hash

  current_hash="$(hash_file "$source_file")"
  if [[ ! -f "$stamp_file" ]]; then
    return 0
  fi

  [[ "$current_hash" != "$(cat "$stamp_file")" ]]
}

write_stamp() {
  local source_file="$1"
  local stamp_file="$2"
  mkdir -p "$(dirname "$stamp_file")"
  hash_file "$source_file" >"$stamp_file"
}

echo "[deploy] root: $ROOT_DIR"
cd "$ROOT_DIR"

echo "[deploy] syncing git branch: $BRANCH"
git fetch origin
git pull --ff-only origin "$BRANCH"

echo "[deploy] current commit: $(git rev-parse --short HEAD)"

if [[ ! -x "$BACKEND_VENV_PYTHON" || ! -x "$BACKEND_VENV_PIP" ]]; then
  echo "backend virtualenv is missing under $ROOT_DIR/backend/.venv" >&2
  exit 1
fi

mkdir -p "$DEPLOY_STATE_DIR"

BACKEND_REQ_STAMP="$DEPLOY_STATE_DIR/backend-requirements.sha256"
FRONTEND_LOCK_STAMP="$DEPLOY_STATE_DIR/frontend-package-lock.sha256"

if should_refresh "$ROOT_DIR/backend/requirements.txt" "$BACKEND_REQ_STAMP"; then
  echo "[deploy] installing backend dependencies"
  "$BACKEND_VENV_PIP" install -r "$ROOT_DIR/backend/requirements.txt"
  write_stamp "$ROOT_DIR/backend/requirements.txt" "$BACKEND_REQ_STAMP"
else
  echo "[deploy] backend dependencies unchanged, skipping install"
fi

cd "$ROOT_DIR/frontend"

if [[ ! -d node_modules ]] || should_refresh "$ROOT_DIR/frontend/package-lock.json" "$FRONTEND_LOCK_STAMP"; then
  echo "[deploy] installing frontend dependencies"
  npm ci --no-audit --no-fund
  git restore package-lock.json
  write_stamp "$ROOT_DIR/frontend/package-lock.json" "$FRONTEND_LOCK_STAMP"
else
  echo "[deploy] frontend dependencies unchanged, skipping install"
fi

echo "[deploy] building frontend"
NEXT_PUBLIC_API_PORT="${NEXT_PUBLIC_API_PORT:-8000}" npm run build

cd "$ROOT_DIR"

echo "[deploy] restarting services"
systemctl restart "$BACKEND_SERVICE"
systemctl restart "$FRONTEND_SERVICE"

echo "[deploy] waiting for health checks"
wait_for_url "$BACKEND_HEALTH_URL" "backend"
wait_for_url "$FRONTEND_HEALTH_URL" "frontend"

echo "[deploy] service status"
systemctl --no-pager --lines=5 status "$BACKEND_SERVICE" "$FRONTEND_SERVICE"

echo "[deploy] ports"
ss -ltnp | egrep ':3000|:8000' || true

