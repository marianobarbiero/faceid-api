#!/usr/bin/env bash
# Publish the API + React demo through a Cloudflare Quick Tunnel (no account needed).
#
#   backend  : uvicorn app.main:app on 127.0.0.1:8000 (1 worker, DeepFace is RAM hungry)
#   frontend : vite build (VITE_API_URL=/api) served by `vite preview` on :4173,
#              which proxies /api -> backend
#   tunnel   : cloudflared tunnel --url http://localhost:4173
#
# Usage: ./scripts/tunnel.sh   (Ctrl+C stops everything)
#
# Windows + NVIDIA GPU: TensorFlow only uses the GPU under WSL2, so the backend can run
# inside a WSL distro while the frontend and tunnel stay on Windows (see DEPLOY_TUNNEL.md):
#   WSL_DISTRO=Ubuntu-22.04 ./scripts/tunnel.sh
#
# Local network only (no tunnel, nothing exposed to the internet): serves the demo over
# HTTPS with a self-signed certificate so phones on the same Wi-Fi can use the camera:
#   LAN=1 ./scripts/tunnel.sh
# Compatible with the bash 3.2 shipped with macOS.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/demo/faceid-react"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"
# Optional: run the backend inside this WSL distro (GPU). It must have ~/faceid-env.sh
WSL_DISTRO="${WSL_DISTRO:-}"
# Optional: LAN=1 skips the tunnel and serves HTTPS on the local network
LAN="${LAN:-}"
CERT_DIR="$ROOT_DIR/.certs"

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
  # Killing wsl.exe does not stop the Linux process it started
  if [ -n "$WSL_DISTRO" ]; then
    wsl.exe -d "$WSL_DISTRO" -- pkill -f "uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT" 2>/dev/null || true
  fi
  echo "==> Done."
}
trap cleanup INT TERM EXIT

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' not found. $2" >&2
    exit 1
  fi
}

[ -n "$LAN" ] || require cloudflared "See DEPLOY_TUNNEL.md for installation."
[ -z "$LAN" ] || require openssl "Needed to create the local HTTPS certificate."
require npm "Install Node.js 20+."
require curl "Install curl."

# Python: prefer the project virtualenv (not needed when the backend runs in WSL)
if [ -n "$WSL_DISTRO" ]; then
  require wsl.exe "WSL_DISTRO is only supported from Git Bash on Windows."
elif [ -x "$ROOT_DIR/.venv/bin/python" ]; then
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

if [ -n "$WSL_DISTRO" ]; then
  echo "==> Starting backend in WSL ($WSL_DISTRO) on 127.0.0.1:$BACKEND_PORT (log: logs/backend.log)"
  # MSYS_NO_PATHCONV: keep Git Bash from rewriting the Linux paths in the command.
  # The log is written from inside Linux: wsl.exe relays stdout and stderr separately,
  # and redirecting both on the Windows side makes them overwrite each other's lines.
  MSYS_NO_PATHCONV=1 wsl.exe -d "$WSL_DISTRO" --cd "$(cygpath -w "$ROOT_DIR")" -- bash -c \
    "source ~/faceid-env.sh && exec python -m uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT --workers 1 > logs/backend.log 2>&1" &
else
  echo "==> Starting backend on 127.0.0.1:$BACKEND_PORT (log: logs/backend.log)"
  (cd "$ROOT_DIR" && exec "$PYTHON" -m uvicorn app.main:app \
    --host 127.0.0.1 --port "$BACKEND_PORT" --workers 1) >"$LOG_DIR/backend.log" 2>&1 &
fi
PIDS="$PIDS $!"

echo "==> Building frontend (VITE_API_URL=/api)"
# MSYS2_ENV_CONV_EXCL: stop Git Bash on Windows from rewriting /api into C:/Program Files/Git/api
(cd "$FRONTEND_DIR" && { [ -d node_modules ] || npm ci; } \
  && MSYS2_ENV_CONV_EXCL=VITE_API_URL VITE_API_URL=/api npm run build)

FRONTEND_SCHEME="http"
if [ -n "$LAN" ]; then
  # LAN address of this machine (Windows, macOS, Linux)
  LAN_IP="$(powershell.exe -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { \$_.IPv4DefaultGateway -and \$_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress" 2>/dev/null | tr -d '\r' || true)"
  [ -n "$LAN_IP" ] || LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  [ -n "$LAN_IP" ] || LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  [ -n "$LAN_IP" ] || { echo "Error: could not find this machine's LAN address" >&2; exit 1; }

  # One self-signed certificate per LAN address (browsers check the IP against it)
  mkdir -p "$CERT_DIR"
  CERT="$CERT_DIR/cert-$LAN_IP.pem"
  KEY="$CERT_DIR/key-$LAN_IP.pem"
  if [ ! -f "$CERT" ]; then
    echo "==> Creating a self-signed HTTPS certificate for $LAN_IP"
    # Run from the cert folder with relative names: MSYS_NO_PATHCONV keeps Git Bash from
    # rewriting "/CN=..." into a Windows path, but would also break absolute output paths
    if ! (cd "$CERT_DIR" && MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
      -keyout "key-$LAN_IP.pem" -out "cert-$LAN_IP.pem" -subj "/CN=faceid-demo" \
      -addext "subjectAltName=IP:$LAN_IP,IP:127.0.0.1,DNS:localhost" >"$LOG_DIR/openssl.log" 2>&1); then
      echo "Error: could not create the certificate. See logs/openssl.log" >&2
      exit 1
    fi
  fi
  export HTTPS_KEY="$KEY" HTTPS_CERT="$CERT"
  FRONTEND_SCHEME="https"
fi

echo "==> Starting vite preview on $FRONTEND_SCHEME://:$FRONTEND_PORT (log: logs/frontend.log)"
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

until curl -fsSk "$FRONTEND_SCHEME://127.0.0.1:$FRONTEND_PORT/api/health" >/dev/null 2>&1; do
  if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
    echo "Error: vite preview proxy not responding. See logs/frontend.log" >&2
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
echo "    frontend proxy OK"

if [ -n "$LAN" ]; then
  echo
  echo "============================================================"
  echo "  Local network URL : https://$LAN_IP:$FRONTEND_PORT"
  echo "  On this PC        : https://localhost:$FRONTEND_PORT"
  echo "  Open it from a phone on the same Wi-Fi. The certificate is"
  echo "  self-signed: accept the browser warning once."
  echo "  Nothing is exposed to the internet."
  echo "============================================================"
else
  echo "==> Opening Cloudflare Quick Tunnel (log: logs/tunnel.log)"
  cloudflared tunnel --no-autoupdate --url "http://localhost:$FRONTEND_PORT" >"$LOG_DIR/tunnel.log" 2>&1 &
  TUNNEL_PID=$!
  PIDS="$PIDS $TUNNEL_PID"

  URL=""
  for _ in $(seq 1 60); do
    # api.trycloudflare.com is Cloudflare's endpoint (it shows up in error messages), not the tunnel
    URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | grep -v '://api\.' | head -n 1 || true)"
    [ -n "$URL" ] && break
    kill -0 "$TUNNEL_PID" 2>/dev/null || break
    sleep 1
  done
  if [ -z "$URL" ]; then
    echo "Error: could not create the tunnel:" >&2
    grep -iE "error|failed" "$LOG_DIR/tunnel.log" | tail -n 3 >&2 || true
    echo "If it says 'no such host', your DNS blocks trycloudflare.com: use LAN=1 or another DNS." >&2
    exit 1
  fi

  echo
  echo "============================================================"
  echo "  Public URL : $URL"
  echo "  Health     : $URL/api/health"
  echo "  (the URL changes every time the tunnel restarts)"
  echo "============================================================"
fi
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
