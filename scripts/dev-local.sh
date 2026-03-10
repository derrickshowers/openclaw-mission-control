#!/usr/bin/env bash
set -euo pipefail

# OpenClaw agent exec sessions inherit PORT (often the gateway port, e.g. 41640).
# That env leaks into child processes and makes local dev unpredictable.
# This script starts Mission Control web dev with a clean, explicit local config.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

HOST="${HOST:-127.0.0.1}"
PORT_VALUE="${PORT_VALUE:-${1:-3005}}"
AUTH_BASE_URL="${AUTH_BASE_URL:-http://${HOST}:${PORT_VALUE}}"

cd "$PROJECT_ROOT"

exec env \
  -u PORT \
  -u OPENCLAW_GATEWAY_PORT \
  -u HOSTNAME \
  PORT="$PORT_VALUE" \
  HOST="$HOST" \
  NEXTAUTH_URL="$AUTH_BASE_URL" \
  npm run dev -- --hostname "$HOST" --port "$PORT_VALUE"
