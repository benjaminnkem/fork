# Fork

Autonomous DeFi pre-execution risk agent. It applies a known protocol change to a pinned Base mainnet fork, measures the user's Moonwell position from the real contracts, and only surfaces rescue actions the EVM verifies.

> The model proposes. The EVM proves.

V1 scope: Moonwell Core on Base Mainnet. Moonwell is adapter #1, not the product.

This repository is in **Phase 0**: verified protocol research plus a compilable monorepo skeleton. It does not yet read wallets, index governance, or spawn Anvil.

## Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable`)
- Docker + Docker Compose (Mongo/Redis, unused by the skeleton)
- Foundry (`anvil`) for later simulation phases
- Archive-capable Base RPC and an Ethereum RPC for later phases
- Groq API key for later agent phases

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

API health: `http://localhost:4000/health/live`  
Web: `http://localhost:3000`

## Docs

Start with `docs/README.md`, then `docs/PRD.md` and `docs/TECHNICAL_SPECIFICATION.md`. Phase 0 research lives in `docs/PROTOCOL_RESEARCH.md` and `docs/CONTRACT_REGISTRY.md`.
