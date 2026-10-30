#!/usr/bin/env bash
# Starts the public portal on this Mac. Reads GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET from data/oauth.env (gitignored).
set -euo pipefail
cd "$(dirname "$0")"
set -a; source data/oauth.env; set +a
export PUBLIC_URL=https://inference.flisk.si ALLOWED_LOGINS="${ALLOWED_LOGINS:-odykyi}"
pkill -f "node server.mjs" 2>/dev/null || true
nohup node server.mjs > server.log 2>&1 &
sleep 2; cat server.log
