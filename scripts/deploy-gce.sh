#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${FORK_ROOT:-/opt/fork}"
APP_USER="${FORK_APP_USER:-fork}"
WEB_ARTIFACT="${1:-}"
EXPECTED_SHA="${2:-}"
WEB_DIR="$ROOT/apps/web"
WEB_STAGING=""
SERVICES=(fork-api fork-simulator fork-indexer fork-web)

if [[ "$(id -u)" -ne 0 ]]; then
  echo "deploy-gce.sh must run as root" >&2
  exit 1
fi

if [[ -z "$WEB_ARTIFACT" || -z "$EXPECTED_SHA" ]]; then
  echo "usage: deploy-gce.sh WEB_ARTIFACT EXPECTED_SHA" >&2
  exit 1
fi

if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "expected SHA must be a 40-character commit hash" >&2
  exit 1
fi

if [[ ! -d "$ROOT/.git" ]]; then
  echo "repository not found at $ROOT" >&2
  exit 1
fi

if [[ ! -f "$WEB_ARTIFACT" ]]; then
  echo "web artifact not found: $WEB_ARTIFACT" >&2
  exit 1
fi

on_error() {
  echo "deployment failed; service diagnostics follow" >&2
  systemctl --no-pager --full status "${SERVICES[@]}" || true
  journalctl --no-pager -n 80 -u fork-api -u fork-simulator -u fork-indexer -u fork-web || true
}
trap on_error ERR

cleanup() {
  if [[ -n "$WEB_STAGING" && -d "$WEB_STAGING" ]]; then
    rm -rf -- "$WEB_STAGING"
  fi
  rm -f -- "$WEB_ARTIFACT"
}
trap cleanup EXIT

run_as_app() {
  runuser -u "$APP_USER" -- env \
    HOME="/home/$APP_USER" \
    NVM_DIR="/home/$APP_USER/.nvm" \
    PATH="/home/$APP_USER/.foundry/bin:/usr/local/bin:/usr/bin" \
    FORK_ROOT="$ROOT" \
    /bin/bash -lc '
      set -Eeuo pipefail
      . "$NVM_DIR/nvm.sh"
      nvm use 24 >/dev/null
      cd "$FORK_ROOT"
      exec "$@"
    ' -- "$@"
}

echo "==> fetching commit $EXPECTED_SHA"
runuser -u "$APP_USER" -- git -C "$ROOT" fetch --prune origin
if ! runuser -u "$APP_USER" -- git -C "$ROOT" cat-file -e "${EXPECTED_SHA}^{commit}" 2>/dev/null; then
  runuser -u "$APP_USER" -- git -C "$ROOT" fetch origin "$EXPECTED_SHA"
fi
if ! runuser -u "$APP_USER" -- git -C "$ROOT" cat-file -e "${EXPECTED_SHA}^{commit}" 2>/dev/null; then
  echo "commit $EXPECTED_SHA is not available from origin" >&2
  exit 1
fi
runuser -u "$APP_USER" -- git -C "$ROOT" checkout --force --detach "$EXPECTED_SHA"

echo "==> stopping application services"
systemctl stop "${SERVICES[@]}" || true

echo "==> installing dependencies"
run_as_app pnpm install --frozen-lockfile

echo "==> installing Linux web build artifact"
install -d -o "$APP_USER" -g "$APP_USER" "$WEB_DIR"
WEB_STAGING="$(mktemp -d "$WEB_DIR/.next.deploy.XXXXXX")"
tar --extract --gzip --file="$WEB_ARTIFACT" --directory="$WEB_STAGING" \
  --no-same-owner --no-same-permissions
if [[ ! -d "$WEB_STAGING/.next" ]]; then
  echo "web artifact does not contain .next" >&2
  exit 1
fi
chown -R "$APP_USER:$APP_USER" "$WEB_STAGING/.next"
if [[ -d "$WEB_DIR/.next" ]]; then
  mv -- "$WEB_DIR/.next" "$WEB_DIR/.next.previous.$(date +%s)"
fi
mv -- "$WEB_STAGING/.next" "$WEB_DIR/.next"
rmdir -- "$WEB_STAGING"
WEB_STAGING=""
install -d -o "$APP_USER" -g "$APP_USER" "$ROOT/.data"

echo "==> reloading and starting application services"
systemctl daemon-reload
systemctl enable "${SERVICES[@]}"
systemctl start fork-api

wait_http() {
  local url="$1"
  local timeout_seconds="${2:-180}"
  local started_at
  started_at="$(date +%s)"
  while true; do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      return 0
    fi
    if (( $(date +%s) - started_at >= timeout_seconds )); then
      echo "timed out waiting for $url" >&2
      return 1
    fi
    sleep 2
  done
}

wait_http "http://127.0.0.1:4000/health/ready" 180
systemctl start fork-simulator fork-indexer fork-web
wait_http "http://127.0.0.1:3000/" 180

echo "==> deployment health"
systemctl --no-pager --full status "${SERVICES[@]}"
echo "==> deployed $(git -C "$ROOT" rev-parse HEAD)"
