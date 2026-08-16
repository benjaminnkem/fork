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
```

Mongo/Redis are unused until later phases.

## Failures

| Symptom | What to do |
|---|---|
| `verify:contracts` missing bytecode | RPC is wrong chain or registry is stale; do not invent addresses |
| Production start refuses | Check `docs/ENVIRONMENT.md`; missing secrets fail closed |
| Anvil host not localhost in production | Simulator refuses to start |

## Later phases

Real-chain smoke, fork replay, and Groq checks are not available yet.
