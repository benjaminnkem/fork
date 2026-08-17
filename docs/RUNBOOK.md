# Runbook

## Local

Zero-context setup is in `docs/HANDOFF.md`. Short path:

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
pnpm replay:verify
pnpm receipt:reproduce .data/replay-moonwell-176.json
pnpm fork:strategies moonwell-176 --force-search-buffer
pnpm fork:agent moonwell-176
docker compose up -d
pnpm --filter api start
pnpm --filter simulator start
```

Web: `http://localhost:3000`  
Paste a Base address for read-only analysis. Connect wallet is optional. **Prove ownership** signs a nonce-bound message before policy or execution.

Set `ENABLE_MAINNET_TRANSACTION_PREPARATION=true` only when you intend to prepare signable calls. The API still will not send them. Automated tests do not broadcast mainnet transactions.

Fresh-checkout replay (needs archive Base + Ethereum RPC and `anvil`):

```bash
cp .env.example .env
pnpm install
pnpm replay:verify
```

That command reads committed anchors in `replays/moonwell-176.json`, checks proposal 176 / block hashes / bytecode, forks Base `48025643`, applies the exact CF calldata, and prints the measured risk. It does not load saved liquidity numbers. The pinned historical wallet may lose liquidity without becoming insolvent; the report says so.

Indexer: `pnpm --filter indexer start`  
Health/metrics: `curl localhost:4000/api/v1/monitoring`  
Enable monitoring on a proved wallet in the UI, or `PUT /api/v1/wallets/:address/monitoring`.

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

## Release gate

Evidence for the last full live gate is `docs/RELEASE_GATE.md`. Re-run from a clean checkout with archive RPC, Groq, Mongo, Redis, and Anvil before claiming green again.
