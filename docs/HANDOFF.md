# Fork handoff

For an engineer with no prior context. Last updated 2026-08-17 after Phase 15. Live gate evidence is `docs/RELEASE_GATE.md`.

## What this is

Fork is a DeFi pre-execution risk agent for **Moonwell Core on Base 8453**. It does not predict prices. It applies a **known protocol change** to a **pinned Base mainnet fork**, reads risk from the live Comptroller, and only surfaces a rescue the EVM verified.

> The model proposes. The EVM proves.

Moonwell is adapter #1, not the product. V1 strategies are `REPAY_DEBT` and `ADD_COLLATERAL`. Governance source is Ethereum MultichainGovernor after MIP-X58. Destination replay is labeled `DESTINATION_EFFECT_REPLAY` (impersonate Temporal Governor with exact calldata). It is not a full Wormhole VAA replay.

## What was built

| Layer | What it does |
|---|---|
| `@fork/blockchain` | viem clients, anchors, fail-closed RPC, bigint-safe JSON |
| `@fork/abis` | pinned registry `moonwell-core-2026-08-16` |
| `@fork/protocol-moonwell` | positions, liquidity, CF decode, destination-effect replay, strategy plans |
| `@fork/governance-core` | normalized changes, exposure, cursors, reorg helpers |
| `@fork/risk-engine` | policy + material-risk class from Comptroller numbers |
| `@fork/simulation-core` | Anvil lifecycle, receipts, economic hash |
| `@fork/strategy-engine` | search/compare wrappers over Moonwell plans |
| `@fork/agent-core` | Groq local tool calling; no solvency math; no send-tx tool |
| `@fork/persistence` | Mongo schemas/indexes |
| `apps/api` | Nest `/api/v1`, SSE, auth, execution prepare |
| `apps/simulator` | BullMQ `impact-simulation` worker; owns Anvil |
| `apps/indexer` | poll Ethereum/Base, refresh status, enqueue pinned 176 for monitored wallets |
| `apps/web` | Next.js App Router dashboard |
| `replays/moonwell-176.json` | identifiers/anchors only; numbers are recomputed |

Pinned historical event: proposal **176**, mwrsETH CF 0.68e18 → 0.52e18, Base fork `48025643` / `0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc`.

## 1. Environment variables

Keep this synchronized with `.env.example` and `packages/config/src/env.ts`. Production (`NODE_ENV=production` or `APP_ENV=production`) refuses to start without `SESSION_SECRET`, `MONGODB_URI`, `REDIS_URL`, `BASE_RPC_URL`, and `ETHEREUM_RPC_URL`. It also refuses `ENABLE_AUTONOMOUS_MAINNET_EXECUTION=true`.

### Shared

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `NODE_ENV` | no, default `development` | no | `development` / `test` / `production` |
| `APP_ENV` | no, default `local` | no | `local` / `test` / `staging` / `production` |
| `APP_VERSION` | no | no | receipt/log label |
| `LOG_LEVEL` | no | no | pino level |

### `apps/api`

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `API_PORT` | no, 4000 | no | local bind |
| `WEB_ORIGIN` | no, `http://localhost:3000` | no | browser origin for CORS + auth nonce domain |
| `API_PUBLIC_URL` | no | no | public API URL |
| `SESSION_SECRET` | production | yes | `openssl rand -hex 32`. Local unset generates an ephemeral secret (sessions die on restart) |
| `AUTH_NONCE_TTL_SECONDS` | no, 300 | no | signed-nonce lifetime |
| `AUTH_SESSION_TTL_SECONDS` | no, 28800 | no | HttpOnly cookie session |
| `PUBLIC_RATE_LIMIT_TTL_SECONDS` / `PUBLIC_RATE_LIMIT_MAX` | no | no | public analysis limiter |

### Persistence (`api`, `indexer`, `simulator`)

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `MONGODB_URI` | production; local simulations | yes | local compose `mongodb://localhost:27017/fork` or Atlas |
| `MONGODB_DB_NAME` | no, `fork` | no | database name |
| `REDIS_URL` | production; queues | yes | local compose `redis://localhost:6379` or managed Redis |

### Chain (`api`, `indexer`, `simulator`, CLIs)

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `BASE_CHAIN_ID` | must be 8453 | no | locked |
| `BASE_RPC_URL` | real-chain + production | yes if keyed | Alchemy / QuickNode **Base Mainnet archive** HTTPS URL |
| `BASE_FALLBACK_RPC_URL` | no | maybe | default `https://mainnet.base.org` (rate-limited, not archive) |
| `ETHEREUM_CHAIN_ID` | must be 1 | no | locked |
| `ETHEREUM_RPC_URL` | real-chain + production | yes if keyed | Alchemy / QuickNode **Ethereum Mainnet** HTTPS URL |
| `ETHEREUM_FALLBACK_RPC_URL` | no | maybe | optional; there is no default public Ethereum fallback |

Alchemy: create two apps (or one multi-network) at https://dashboard.alchemy.com/ — Base and Ethereum. History/archive is required for `pnpm replay:verify`.

### Moonwell registry

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `MOONWELL_REGISTRY_VERSION` | no | no | default `moonwell-core-2026-08-16` |
| `MOONWELL_ALLOW_REGISTRY_OVERRIDE` | no, false | no | keep false in production |

Addresses live in `packages/abis/src/registry/moonwell-core-2026-08-16.json`. Do not invent replacements.

### Indexer

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `GOVERNANCE_POLL_INTERVAL_MS` | no, 60000 | no | tick interval |
| `GOVERNANCE_LOG_BLOCK_RANGE` | no, 5000 | no | `eth_getLogs` window (Alchemy often 10) |
| `GOVERNANCE_BASE_START_BLOCK` / `GOVERNANCE_ETHEREUM_START_BLOCK` | unused | no | reserved names in `.env.example`. **Code does not read them.** Cursors persist in `.data/governance-store.json` |
| `RUN_INDEXER` | tests only | no | `1` enables the live indexer tick test |

### Simulator

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `ANVIL_BINARY` | no, `anvil` | no | Foundry on `PATH` |
| `ANVIL_HOST` | no, `127.0.0.1` | no | production refuses a non-localhost host |
| `ANVIL_PORT_START` | no, 9500 | no | first Anvil port |
| `MAX_PARALLEL_FORKS` | no, 2 | no | machine capacity |
| `SIMULATION_TIMEOUT_MS` | no, 120000 | no | job timeout |
| `FORK_START_TIMEOUT_MS` | no, 180000 | no | archive fork can exceed 15s |
| `SIMULATION_RECEIPT_SCHEMA_VERSION` | no, `1` | no | receipt schema |
| `SIMULATION_MAX_AGE_SECONDS` | no, 300 | no | freshness |

Queue inflight is a code constant (`IMPACT_QUEUE_MAX_INFLIGHT=16`), not an env var.

### Agent / Groq (`fork:agent`, optional API traces)

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `GROQ_API_KEY` | live agent | yes | https://console.groq.com/keys — must start with `gsk_` |
| `GROQ_PLANNER_MODEL` | no | no | `openai/gpt-oss-120b` |
| `GROQ_FALLBACK_MODEL` | no | no | `openai/gpt-oss-20b` |
| `AGENT_MAX_STEPS` | no, 10 | no | loop cap |
| `AGENT_TIMEOUT_MS` | no, 180000 | no | 90s is too tight when Anvil is a tool |
| `AGENT_REASONING_EFFORT` | no, medium | no | `low` / `medium` / `high` |
| `AGENT_MAX_COMPLETION_TOKENS` | no, 2048 | no | completion budget |
| `AGENT_MAX_INVALID_CALLS` | no, 3 | no | fail closed |
| `AGENT_INCLUDE_REASONING` | no, false | no | must stay false in production |
| `RUN_AGENT` | tests/CLI evidence | no | `1` to run live agent tests |

### Risk / execution

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `DEFAULT_MIN_SAFETY_BUFFER_BPS` | product owner | no | **do not invent**. Empty → `NO_ADDITIONAL_BUFFER` |
| `ENABLE_MAINNET_TRANSACTION_PREPARATION` | no, false | no | set `true` only when you want signable plans |
| `ENABLE_AUTONOMOUS_MAINNET_EXECUTION` | must stay false | no | V1 forbids this |

### `apps/web`

| Variable | Required | Secret | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | web | no | `http://localhost:4000/api/v1` locally; public API in deploy |
| `NEXT_PUBLIC_BASE_CHAIN_ID` | no, 8453 | no | locked |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | no | https://cloud.reown.com/ (injected wallets work without it) |
| `RUN_WEB_E2E` | tests | no | `1` for live Playwright |
| `RUN_API_E2E` | tests | no | `1` for Nest+BullMQ e2e |

Never prefix a secret with `NEXT_PUBLIC_`.

## 2. Local setup

Prerequisites:

- Node 20+ (`.nvmrc` is 20; Node 24 is fine)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- Docker Desktop + Compose
- Foundry (`curl -L https://foundry.paradigm.xyz | bash` then `foundryup`; need `anvil`)
- Alchemy (or equivalent) Base archive + Ethereum HTTPS URLs
- Groq key only if you will run the agent

```bash
git clone <this-repo>
cd fork
cp .env.example .env
```

Edit `.env`:

```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<key>
GROQ_API_KEY=gsk_...
SESSION_SECRET=$(openssl rand -hex 32)
```

Leave `DEFAULT_MIN_SAFETY_BUFFER_BPS` empty unless a product owner set it. Leave `ENABLE_AUTONOMOUS_MAINNET_EXECUTION=false`.

```bash
pnpm install
docker compose up -d mongodb redis
pnpm verify:contracts
pnpm chain:smoke
pnpm dev
```

`pnpm dev` starts web `:3000`, api `:4000`, indexer, and simulator. Indexes are created at API/simulator startup. There is no `pnpm db:indexes`.

Separate processes:

```bash
pnpm --filter api start
pnpm --filter simulator start
pnpm --filter indexer start
pnpm --filter web dev
```

Health: `curl localhost:4000/health/live` and `curl localhost:4000/health/ready`. Web: http://localhost:3000

## 3. Production deployment order

There are no production Docker images in this repo. Compose only runs Mongo 7 and Redis 7. API/indexer/simulator start TypeScript via `tsx` (`build` is `tsc --noEmit`). Web is `next build` / `next start`.

1. Provision **private** Mongo and Redis. Do not expose them to the public internet.
2. Provision archive-capable Base RPC and Ethereum RPC. Do not put API keys in the browser bundle.
3. Generate `SESSION_SECRET`. Set `APP_ENV=production` and `NODE_ENV=production`.
4. Confirm `ENABLE_AUTONOMOUS_MAINNET_EXECUTION=false` and `MOONWELL_ALLOW_REGISTRY_OVERRIDE=false`.
5. Confirm `ANVIL_HOST=127.0.0.1`. The simulator refuses a non-localhost Anvil bind in production.
6. Deploy **simulator** first onto a host with Foundry/`anvil`, Mongo, Redis, and both RPCs.
7. Deploy **api**. Wait until `GET /health/ready` returns `status: ok` (Mongo, Redis, Base 8453, Ethereum 1).
8. Deploy **indexer** as a single process (no leader election). It writes `.data/governance-store.json` on the host unless you replace the store.
9. Deploy **web** (Vercel or `next start`) with `NEXT_PUBLIC_API_URL` pointing at the public API `/api/v1` and `NEXT_PUBLIC_BASE_CHAIN_ID=8453`.
10. Point `WEB_ORIGIN` at the real web origin before enabling wallet auth.
11. Smoke: `/health/ready`, paste a real Base address, `pnpm replay:verify` on a host that has Anvil + archive RPC.
12. Only then set `ENABLE_MAINNET_TRANSACTION_PREPARATION=true` if you want user-signed plans. The API still never broadcasts.

Suggested process supervision: systemd, Docker-with-Foundry you build yourself, or a VM. GitHub Actions `ci.yml` runs lint/types/tests/build on `master`/`main`. Workflow `replay` is manual and needs repo secrets `BASE_RPC_URL` and `ETHEREUM_RPC_URL`.

Do not put Anvil on a public port. Do not log RPC URLs or Groq keys. Groq is optional for read-only analysis.

## 4. Real end-to-end test procedure

Static (no RPC):

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

Local infra + chain:

```bash
docker compose up -d mongodb redis
pnpm verify:contracts
pnpm chain:smoke
pnpm moonwell:wallet 0x494c7fdb753c15b69fea2293e1b76567ca94462d
pnpm governance:sync
pnpm replay:verify
pnpm fork:strategies moonwell-176
pnpm fork:strategies moonwell-176 --force-search-buffer
RUN_AGENT=1 pnpm fork:agent moonwell-176 0x494c7fdb753c15b69fea2293e1b76567ca94462d
```

API + UI (separate terminals):

```bash
pnpm --filter api start
pnpm --filter simulator start
RUN_API_E2E=1 pnpm --filter api exec vitest run src/simulations/simulations.e2e.test.ts
RUN_WEB_E2E=1 WEB_ORIGIN=http://localhost:3000 pnpm test:e2e
pgrep anvil || echo "no orphan anvil"
```

Do not mark a release green if any of those fail because a mock was introduced. If Groq/RPC quota flakes, retry; do not skip and claim green. Last green live run: `docs/RELEASE_GATE.md`.

## 5. Reproduce the historical replay

Needs archive Base RPC, Ethereum RPC, and `anvil`.

```bash
pnpm replay:verify
```

That reads `replays/moonwell-176.json` (anchors only), checks proposal 176 / block hashes / bytecode, forks Base `48025643`, impersonates Temporal Governor `0x8b621804a7637b781e2BbD58e256a591F2dF7d51`, sends exact `_setCollateralFactor` on Comptroller `0xfBb21d0380beE3312B33c4353c8936a0F13EF26C` for market `0xfC41B49d064Ac646015b459C522820DB9472F4B5` to `0.52e18`, and prints Comptroller before/after plus receipt hash.

Optional: `pnpm fork:replay moonwell-176` writes `.data/replay-moonwell-176.json`. Then `pnpm receipt:reproduce .data/replay-moonwell-176.json` compares economic fields. Anvil post-tx hashes are run evidence and are not part of the receipt hash.

Last measured receipt hash: `0xcf47d2732a3055af754dc902be2c8a5963516ddf599edddd2d35857f5111d0b9` (SAFE → SAFE, `LIQUIDITY_REDUCED`).

## 6. Test a live Base wallet

```bash
pnpm moonwell:wallet 0x494c7fdb753c15b69fea2293e1b76567ca94462d
```

Or open http://localhost:3000, paste any 20-byte Base address, Analyze. Connecting a wallet is not ownership. **Prove ownership** signs a nonce bound to `WEB_ORIGIN` and Base 8453. Policy PUT and execution prepare require that session.

Known fixtures:

- Isolated ADD_COLLATERAL: `0x494c7fdb753c15b69fea2293e1b76567ca94462d`
- Historical 176 supplier (no rescue inventory at the fork block): `0x9eec3976435a37b0340ecbd966c226a691956b35`
- Repay smoke used in earlier phases: `0x416ec2ca21a38cbcfeacd6a14532b3f348356d23`

Do not mint tokens if a wallet cannot rescue.

## 7. Verify proof receipts

- UI: after COMPLETED, Open proof. Schema/hash/provenance must be present.
- API: `GET /api/v1/simulations/:id/proof`
- CLI: `pnpm replay:verify` and compare `replayedReceiptHash` to a prior run's economic hash.

Receipts hash the economic/provenance body only. Liquidity/shortfall come from Comptroller `getAccountLiquidity`. If replay did not create a shortfall, the product must not say it did.

## 8. Known limitations / risks

See `docs/KNOWN_LIMITATIONS.md`. Material ones:

- Destination-effect impersonation, not Wormhole.
- No product safety-buffer default.
- Historical wallet cannot rescue at the pinned block.
- Server never sends mainnet txs. Autonomous execution is off.
- File-store destination status can lag later CF moves.
- Local `SESSION_SECRET` unset uses an ephemeral secret.
- `packages/ui` (`@repo/ui`) is leftover Turborepo starter and is not used by the product.
- `GOVERNANCE_*_START_BLOCK` is unused.
- `/health/ready` does not ping Groq (rate limits).
- No hosted production deployment has been exercised.

## 9. After this / before hackathon submission

**Build next (after submission, or only if a judge/product owner asks):**

- Product-owner value for `DEFAULT_MIN_SAFETY_BUFFER_BPS`
- Hosted deploy with a real `SESSION_SECRET` and private Mongo/Redis
- Additional Moonwell change classes after primary-source research
- Notifications
- Full transport-level governance replay
- Wire start-block env vars if you need a controlled backfill

**Do not touch before submission:**

- Do not invent a safety-buffer default
- Do not set `ENABLE_AUTONOMOUS_MAINNET_EXECUTION=true`
- Do not add Aave/Compound/Morpho logos or adapters
- Do not change `replays/moonwell-176.json` anchors to “make the demo worse”
- Do not mint tokens onto a fork to fake a rescue
- Do not mock RPC/Moonwell/Groq in any acceptance path
- Do not put private keys in the API
- Do not enable `MOONWELL_ALLOW_REGISTRY_OVERRIDE` in production
- Do not replace Comptroller liquidity with an LLM or JS float
- Do not rewrite `@fork/protocol-moonwell` governance decode without official sources + onchain checks
- Do not delete the destination-effect honesty labels

## Audit (Phase 15)

| Check | Result |
|---|---|
| Stale `TODO`/`FIXME` in product code | none that replace a feature |
| Mock adapters in acceptance paths | none |
| Unsupported protocol logos | none |
| Secrets in git | `.env` ignored; no `gsk_` / keyed RPC in tracked files |
| Docs/code divergence fixed here | `pnpm db:indexes` does not exist; `governance:sync` has no `--once`; `FORK_START_TIMEOUT_MS` default is 180000; `GOVERNANCE_*_START_BLOCK` unused; CI now runs on `master` |
| Dead starter | `@repo/ui` leftover hello-button; unused |
| CI vs default branch | was `main` only; repo is `master` |

## How mainnet user signing works

1. User analyzes a public address (no wallet required).
2. User connects an injected wallet on Base 8453 (WalletConnect optional).
3. **Prove ownership** → `POST /auth/nonce` → personal_sign → HttpOnly session cookie.
4. If `ENABLE_MAINNET_TRANSACTION_PREPARATION=true`, UI calls `POST /execution/prepare` with wallet + simulation id + strategy class. The API **rebuilds** allowlisted calls from live Moonwell state. Client calldata is rejected.
5. API dry-runs the exact plan on an Anvil fork of the current Base safe head.
6. UI shows target, method, amount, spender. User signs each call in the wallet. API never has the key and never broadcasts.
7. UI submits the hash to `POST /execution/:id/register-tx`. API waits for the Base receipt, re-reads Comptroller, marks VERIFIED / PARTIAL / MISMATCH / FAILED.
8. Wallet switch or wrong chain is refused in the UI.

## Groq models and rate limits

```bash
curl -sS https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

Confirm `openai/gpt-oss-120b` and `openai/gpt-oss-20b` are listed. Free-plan RPM/RPD is external and can change. A 401 on a non-`gsk_` key is classified `GROQ_UNAVAILABLE`. Agent outage fails closed; it does not invent Comptroller numbers. `/health/ready` only reports whether a key is configured.

## Phase 15 static re-run (2026-08-17)

| Command | Result | Time |
|---|---|---|
| `pnpm lint` | pass | 26.05s |
| `pnpm check-types` | pass | 87.87s |
| `pnpm test` | pass (live replay/agent/API e2e skipped without gate flags) | 83.00s |
| `pnpm build` | pass; Next.js 16.3.1 production build | 123.34s |

`turbo` warns that API/indexer/simulator/package builds have no emit outputs. That is expected: those `build` scripts are `tsc --noEmit`. Runtime is `tsx`. The live Anvil/Groq/Playwright gate was not re-run in Phase 15; it remains green in `docs/RELEASE_GATE.md` from the same checkout (`58d68e3` plus these docs).
