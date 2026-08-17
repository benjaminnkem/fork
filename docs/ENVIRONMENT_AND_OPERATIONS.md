# Fork — Environment, Local Setup & Operations

This document describes the intended configuration surface. Codex must keep the actual `.env.example` synchronized as implementation introduces/removes variables.

## 1. Prerequisites

Developer machine/host needs:

- Git;
- current supported Node.js LTS compatible with selected Next/Nest dependencies;
- `pnpm` via Corepack or pinned installer;
- Docker + Docker Compose;
- Foundry (`anvil`, `forge`, `cast`);
- a Base Mainnet archive-capable RPC;
- an Ethereum Mainnet archive/history-capable RPC for current Moonwell governance indexing;
- Groq API key;
- browser wallet for connected execution testing.

Do not require Base Sepolia for core product simulation.

## 2. Recommended `.env` groups

### Shared/application

```env
NODE_ENV=development
APP_ENV=local
APP_VERSION=dev
LOG_LEVEL=debug
```

### API

```env
API_PORT=4000
WEB_ORIGIN=http://localhost:3000
API_PUBLIC_URL=http://localhost:4000
SESSION_SECRET=<strong-random-secret>
AUTH_NONCE_TTL_SECONDS=300
AUTH_SESSION_TTL_SECONDS=28800
PUBLIC_RATE_LIMIT_TTL_SECONDS=60
PUBLIC_RATE_LIMIT_MAX=60
```

### Database

```env
MONGODB_URI=mongodb://localhost:27017/fork
MONGODB_DB_NAME=fork
REDIS_URL=redis://localhost:6379
```

### Base Mainnet

```env
BASE_CHAIN_ID=8453
BASE_RPC_URL=<archive-capable-primary-base-rpc>
BASE_FALLBACK_RPC_URL=https://mainnet.base.org
```

The official Base public RPC is rate-limited and should be a fallback/development aid, not assumed production capacity.

### Ethereum Mainnet governance source

```env
ETHEREUM_CHAIN_ID=1
ETHEREUM_RPC_URL=<primary-ethereum-rpc>
ETHEREUM_FALLBACK_RPC_URL=<optional-fallback>
```

Moonwell's current primary governor location must be verified in the protocol adapter; do not assume an env address copied from this handoff.

### Moonwell registry

Prefer versioned config files for verified addresses rather than dozens of mutable env vars. If addresses must be overridden for emergency/testing, use explicit variables such as:

```env
MOONWELL_REGISTRY_VERSION=<version-or-commit>
MOONWELL_ALLOW_REGISTRY_OVERRIDE=false
```

Production override should be fail-closed and visibly logged.

### Governance indexer

```env
GOVERNANCE_POLL_INTERVAL_MS=60000
GOVERNANCE_BASE_START_BLOCK=<verified-start-block>
GOVERNANCE_ETHEREUM_START_BLOCK=<verified-start-block>
GOVERNANCE_LOG_BLOCK_RANGE=5000
```

Ranges must be configurable because RPC providers impose different `eth_getLogs` limits.

### Simulator

```env
ANVIL_BINARY=anvil
ANVIL_HOST=127.0.0.1
ANVIL_PORT_START=9500
MAX_PARALLEL_FORKS=2
SIMULATION_TIMEOUT_MS=120000
FORK_START_TIMEOUT_MS=15000
SIMULATION_RECEIPT_SCHEMA_VERSION=1
```

### Agent/Groq

```env
GROQ_API_KEY=<secret>
GROQ_PLANNER_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
AGENT_MAX_STEPS=10
AGENT_TIMEOUT_MS=180000
AGENT_MAX_COMPLETION_TOKENS=<chosen-budget>
AGENT_REASONING_EFFORT=medium
```

At startup, verify configured model IDs are currently available. Groq model/rate-limit policy is external and can change.

### Risk defaults

```env
DEFAULT_MIN_SAFETY_BUFFER_BPS=<product-decided-value>
SIMULATION_MAX_AGE_SECONDS=<freshness-window>
```

Do not guess a financial policy value in code. Product owner should explicitly approve the default displayed to users.

### Execution

```env
ENABLE_MAINNET_TRANSACTION_PREPARATION=true
ENABLE_AUTONOMOUS_MAINNET_EXECUTION=false
```

The second variable stays false for V1. The backend has no private key anyway.

### Web public vars

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_BASE_CHAIN_ID=8453
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<optional-if-walletconnect-enabled>
```

Never prefix secrets with `NEXT_PUBLIC_`.

## 3. Local startup target

Expected future commands after implementation:

```bash
pnpm install
cp .env.example .env

docker compose up -d mongodb redis

pnpm db:indexes
pnpm verify:contracts
pnpm dev
```

Or separately:

```bash
pnpm --filter api dev
pnpm --filter indexer dev
pnpm --filter simulator dev
pnpm --filter web dev
```

Exact scripts must be documented by Codex after implementation.

## 4. Real-chain smoke sequence

1. `pnpm verify:contracts`
2. `pnpm chain:base:smoke`
3. `pnpm chain:ethereum:smoke`
4. `pnpm moonwell:wallet <address>`
5. `pnpm governance:sync --once`
6. `pnpm fork:replay <real-scenario-slug>`
7. `pnpm replay:verify` (fresh checkout; optional `pnpm receipt:reproduce .data/replay-moonwell-176.json` to compare a previous run)
8. `pnpm fork:strategies moonwell-176 --force-search-buffer`
9. `pnpm fork:agent moonwell-176`
10. `docker compose up -d` then start API and simulator
11. run Playwright E2E (`pnpm test:e2e`; set `RUN_WEB_E2E=1` with API + simulator for the live Anvil path).

None of these should return fabricated fallback data.

## 5. Deployment topology

### Small/hackathon production

- Next.js: Vercel or Docker Node host.
- API: Docker service.
- Indexer: separate Docker process/service.
- Simulator worker: Docker service/VM with Foundry installed.
- MongoDB: Atlas or managed Mongo.
- Redis: managed Redis or private Docker Redis.

API/indexer/simulator may share one VM initially but remain separate processes.

### Scale-out

- multiple stateless API replicas;
- one or more indexer instances with leader/locking strategy per source;
- multiple BullMQ simulator workers;
- global simulation concurrency controlled via queue/Redis;
- dedicated high-throughput archive RPC provider(s);
- Mongo replica set/Atlas appropriate tier;
- managed Redis with persistence/HA as required.

## 6. Health endpoints

At minimum:

- `/health/live` — process alive;
- `/health/ready` — required dependencies ready;
- checks for Mongo;
- Redis;
- Base RPC chain ID/current block;
- Ethereum RPC chain ID/current block;
- Moonwell contract registry bytecode;
- Anvil binary availability on simulator worker;
- Groq model availability may be degraded rather than make read-only API totally unavailable.

## 7. Free-tier/cost awareness

Groq Free Plan currently exposes finite RPM/RPD/token quotas. Architect rate limiting/caching so free quota is enough for hackathon traffic, but do not bake “free forever” into product assumptions.

Public Base RPC is rate-limited; use an archive-capable provider for reliable historical forks. Provider cost/quota is an operational choice behind the RPC abstraction.

## 8. Operational failure behavior

### Groq unavailable

- current wallet/protocol risk reads continue;
- deterministic simulation can continue;
- strategy auto-selection may be degraded;
- never fabricate recommendation.

### Base RPC unavailable

- do not claim fresh analysis;
- fallback provider if configured;
- mark stale/degraded state visibly.

### Ethereum RPC unavailable

- live governance freshness degrades;
- do not falsely claim “no upcoming changes.”

### Redis unavailable

- producers fail simulation submission fast with retryable service error;
- existing UI reads can continue;
- worker reconnect policy follows BullMQ guidance.

### Mongo unavailable

- readiness fails for features needing durable state;
- do not run untracked mainnet execution flows.

### Simulator unavailable

- wallet/governance reads may continue;
- impact analysis is unavailable, not guessed.

## 9. Secrets rotation

RPC/Groq/Mongo/Redis/session secrets must be externally configurable and rotatable without code changes. Never record them in simulation receipts or agent traces.
