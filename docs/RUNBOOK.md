# Runbook

## Local

```bash
pnpm install
cp .env.example .env
docker compose up -d mongodb redis
pnpm verify:contracts
pnpm dev
```

Health: `curl localhost:4000/health/live`  
Ready (live RPC probe): `curl localhost:4000/health/ready`

```bash
pnpm verify:contracts
pnpm chain:base:smoke
pnpm chain:ethereum:smoke
pnpm test:chain
pnpm moonwell:wallet 0x416ec2ca21a38cbcfeacd6a14532b3f348356d23
pnpm governance:sync
pnpm fork:replay moonwell-176
pnpm receipt:reproduce .data/replay-moonwell-176.json
pnpm fork:strategies moonwell-176 --force-search-buffer
pnpm fork:agent moonwell-176
docker compose up -d
pnpm --filter api start
pnpm --filter simulator start
```

Web: `http://localhost:3000`  
Paste a Base address for read-only analysis. Connect wallet is optional and does not authenticate.

```bash
pnpm --filter api start
pnpm --filter simulator start
pnpm --filter web dev
RUN_WEB_E2E=1 pnpm test:e2e
```

Mongo schemas live in `@fork/persistence`. Nest/Mongo connect and create indexes at startup.

## Failures

| Symptom | What to do |
|---|---|
| `verify:contracts` missing bytecode | RPC is wrong chain or registry is stale; do not invent addresses |
| Production start refuses | Check `docs/ENVIRONMENT.md`; missing secrets fail closed |
| Anvil host not localhost in production | Simulator refuses to start |

## Later phases

Real-chain smoke, fork replay, and Groq checks are not available yet.
