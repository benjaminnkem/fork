#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:/usr/local/bin:/usr/bin:${PATH}"

echo "==> updating ${ROOT}"
git fetch origin
git checkout master
git pull --ff-only origin master

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
sleep 3
curl -fsS http://127.0.0.1:4000/health/ready
echo
curl -fsS -o /dev/null -w "web=%{http_code}\n" http://127.0.0.1:3000/

echo "==> deploy complete $(git rev-parse --short HEAD)"
