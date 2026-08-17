# Fork

Autonomous DeFi pre-execution risk agent. It applies a known protocol change to a pinned Base mainnet fork, measures the user's Moonwell position from the real contracts, and only surfaces rescue actions the EVM verifies.

> The model proposes. The EVM proves.

V1 scope: Moonwell Core on Base Mainnet. Moonwell is adapter #1, not the product.

This repository is in **Phase 14**: the live release gate is green for the locked V1 scope. See `docs/RELEASE_GATE.md`. Email/Telegram notifications and a product safety-buffer default remain out of V1.

## Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable`)
- Docker + Docker Compose (Mongo/Redis)
- Foundry (`anvil`) for historical replay and impact simulation
- Archive-capable Base RPC and an Ethereum RPC
- Groq API key (`gsk_…`) for `pnpm fork:agent`

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d mongodb redis
pnpm verify:contracts
pnpm dev
```

`pnpm verify:contracts` hits public RPCs unless you set `BASE_RPC_URL` / `ETHEREUM_RPC_URL`.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | web + api + indexer + simulator skeletons |
| `pnpm lint` | ESLint |
| `pnpm check-types` | TypeScript |
| `pnpm test` | Vitest |
| `pnpm build` | all apps/packages |
| `pnpm verify:contracts` | onchain bytecode check of the pinned registry |
| `pnpm chain:smoke` | live Base + Ethereum head + hash anchors |
| `pnpm test:chain` | real-RPC integration tests (requires `.env`) |
| `pnpm moonwell:wallet <0x…>` | read real Moonwell Core positions/risk on Base |
| `pnpm governance:sync` | ingest Ethereum Moonwell proposals and decode Base CF effects |
| `pnpm fork:replay moonwell-176` | Anvil-fork proposal 176 CF change and print a proof receipt |
| `pnpm replay:verify` / `pnpm receipt:reproduce` | recompute moonwell-176 from `replays/moonwell-176.json`; optional prior receipt file for comparison |
| `pnpm fork:strategies moonwell-176 [wallet]` | compare REPAY_DEBT and ADD_COLLATERAL on a real fork |
| `pnpm fork:agent moonwell-176 [wallet]` | Groq agent over the real simulation tools |
| `docker compose up -d` | local MongoDB and Redis |
| `pnpm --filter api start` / `pnpm --filter simulator start` | API + impact worker |
| `pnpm --filter indexer start` | continuous governance monitor |
| `pnpm test:e2e` | Playwright home/error paths; add `RUN_WEB_E2E=1` for live UI → Anvil |

API health: `http://localhost:4000/health/live`  
Web: `http://localhost:3000`

## Docs

Start with `docs/README.md`, then `docs/PRD.md` and `docs/TECHNICAL_SPECIFICATION.md`. Research lives in `docs/PROTOCOL_RESEARCH.md` and `docs/CONTRACT_REGISTRY.md`. The last live release gate is `docs/RELEASE_GATE.md`.
