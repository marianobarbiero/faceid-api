#!/usr/bin/env bash
# Publish the API + React demo through a Cloudflare Quick Tunnel (no account needed).
#
#   backend  : uvicorn app.main:app on 127.0.0.1:8000 (1 worker, DeepFace is RAM hungry)
#   frontend : vite build (VITE_API_URL=/api) served by `vite preview` on :4173,
#              which proxies /api -> backend
#   tunnel   : cloudflared tunnel --url http://localhost:4173
#
# Usage: ./scripts/tunnel.sh   (Ctrl+C stops everything)
# Compatible with the bash 3.2 shipped with macOS.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/demo/faceid-react"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"

PIDS=""

cleanup() {
  trap - INT TERM EXIT
  echo
  echo "==> Stopping processes..."
  for pid in $PIDS; do
    # Kill children first (e.g. node spawned by vite), then the process itself
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in $PIDS; do
    kill -KILL "$pid" 2>/dev/null || true
  done
  echo "==> Done."
}
trap cleanup INT TERM EXIT

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' not found. $2" >&2
    exit 1
  fi
}

require cloudflared "See DEPLOY_TUNNEL.md for installation."
require npm "Install Node.js 20+."
require curl "Install curl."

# Python: prefer the project virtualenv
if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
  PYTHON="$ROOT_DIR/.venv/bin/python"
elif [ -x "$ROOT_DIR/.venv/Scripts/python.exe" ]; then
  PYTHON="$ROOT_DIR/.venv/Scripts/python.exe"
else
  require python3 "Create the virtualenv (.venv) and install requirements.txt."
  PYTHON="python3"
fi

[ -f "$ROOT_DIR/.env" ] || { echo "Error: missing $ROOT_DIR/.env (copy .env.example)" >&2; exit 1; }
[ -f "$FRONTEND_DIR/.env" ] || { echo "Error: missing $FRONTEND_DIR/.env (copy .env.example)" >&2; exit 1; }

mkdir -p "$LOG_DIR"

echo "==> Starting backend on 127.0.0.1:$BACKEND_PORT (log: logs/backend.log)"
(cd "$ROOT_DIR" && exec "$PYTHON" -m uvicorn app.main:app \
  --host 127.0.0.1 --port "$BACKEND_PORT" --workers 1) >"$LOG_DIR/backend.log" 2>&1 &
PIDS="$PIDS $!"

echo "==> Building frontend (VITE_API_URL=/api)"
# MSYS2_ENV_CONV_EXCL: stop Git Bash on Windows from rewriting /api into C:/Program Files/Git/api
(cd "$FRONTEND_DIR" && { [ -d node_modules ] || npm ci; } \
  && MSYS2_ENV_CONV_EXCL=VITE_API_URL VITE_API_URL=/api npm run build)

echo "==> Starting vite preview on :$FRONTEND_PORT (log: logs/frontend.log)"
(cd "$FRONTEND_DIR" && exec ./node_modules/.bin/vite preview \
  --port "$FRONTEND_PORT" --strictPort) >"$LOG_DIR/frontend.log" 2>&1 &
PIDS="$PIDS $!"

echo "==> Waiting for backend /health (up to ${HEALTH_TIMEOUT}s, models are warming up)..."
elapsed=0
until curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; do
  if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
    echo "Error: backend did not respond after ${HEALTH_TIMEOUT}s. See logs/backend.log" >&2
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done
echo "    backend OK"

until curl -fsS "http://127.0.0.1:$FRONTEND_PORT/api/health" >/dev/null 2>&1; do
  if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
    echo "Error: vite preview proxy not responding. See logs/frontend.log" >&2
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
echo "    frontend proxy OK"

echo "==> Opening Cloudflare Quick Tunnel (log: logs/tunnel.log)"
cloudflared tunnel --no-autoupdate --url "http://localhost:$FRONTEND_PORT" >"$LOG_DIR/tunnel.log" 2>&1 &
PIDS="$PIDS $!"

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | head -n 1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "Error: could not get the tunnel URL. See logs/tunnel.log" >&2
  exit 1
fi

echo
echo "============================================================"
echo "  Public URL : $URL"
echo "  Health     : $URL/api/health"
echo "  (the URL changes every time the tunnel restarts)"
echo "============================================================"
echo "Press Ctrl+C to stop."

# Exit (and clean up) as soon as any process dies; bash 3.2 has no `wait -n`
while true; do
  for pid in $PIDS; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Process $pid exited unexpectedly. Check logs/." >&2
      exit 1
    fi
  done
  sleep 2
done
