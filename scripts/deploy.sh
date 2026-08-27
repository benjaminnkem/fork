#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -ne 2 ]]; then
  echo "usage: scripts/deploy.sh WEB_ARTIFACT EXPECTED_SHA" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  exec sudo /bin/bash "$ROOT/scripts/deploy-gce.sh" "$@"
fi

exec /bin/bash "$ROOT/scripts/deploy-gce.sh" "$@"
