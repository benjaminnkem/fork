#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:/usr/local/bin:/usr/bin:${PATH}"

if [[ "${FORK_DEPLOY_READY:-}" != "1" ]]; then
  echo "==> updating ${ROOT}"
  git fetch origin
  git checkout -f master
  git reset --hard origin/master
  export FORK_DEPLOY_READY=1
  exec bash "$ROOT/scripts/deploy.sh"
fi

wait_http() {
  local url="$1"
  local label="$2"
  local timeout_s="${3:-120}"
  local start
  start="$(date +%s)"
  local http=""
  local body
  body="$(mktemp)"
  while true; do
    http="$(curl -sS -o "$body" -w '%{http_code}' --max-time 5 "$url" || true)"
    if [[ "$http" =~ ^2 ]]; then
      echo "${label}=${http}"
      if [[ "$label" == "api" ]]; then
        cat "$body"
        echo
      fi
      rm -f "$body"
      return 0
    fi
    if (( $(date +%s) - start >= timeout_s )); then
      echo "${label} failed url=${url} last_http=${http}" >&2
      sudo systemctl --no-pager --full status fork-api fork-simulator fork-indexer fork-web || true
      sudo journalctl -u fork-web -u fork-api --no-pager -n 120 || true
      rm -f "$body"
      return 1
    fi
    local web_state api_state
    web_state="$(sudo systemctl is-active fork-web || true)"
    api_state="$(sudo systemctl is-active fork-api || true)"
    if [[ "$web_state" == "failed" || "$web_state" == "inactive" || "$api_state" == "failed" || "$api_state" == "inactive" ]]; then
      echo "a required unit left the active state while waiting for ${label} (web=${web_state} api=${api_state})" >&2
      sudo systemctl --no-pager --full status fork-api fork-web || true
      sudo journalctl -u fork-web -u fork-api --no-pager -n 120 || true
      rm -f "$body"
      return 1
    fi
    sleep 2
  done
}

echo "==> installing dependencies"
pnpm install --frozen-lockfile

echo "==> building web"
pnpm --filter web build

echo "==> starting local databases"
docker compose up -d mongodb redis

echo "==> restarting services"
sudo systemctl restart fork-api fork-simulator fork-indexer fork-web
sudo systemctl --no-pager --full status fork-api fork-simulator fork-indexer fork-web || true

echo "==> health"
wait_http "http://127.0.0.1:4000/health/ready" "api" 60
wait_http "http://127.0.0.1:3000/" "web" 120

echo "==> deploy complete $(git rev-parse --short HEAD)"
