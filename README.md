# Fork

Autonomous DeFi pre-execution risk agent for **Moonwell Core on Base Mainnet**. It applies a known protocol change to a pinned Base fork, measures the wallet from the real Comptroller, and only surfaces a rescue the EVM verified.

> The model proposes. The EVM proves.

Moonwell is adapter #1, not the product. V1 strategies: repay debt and add collateral. The server never holds user keys and never broadcasts mainnet transactions.

This repository is in **Phase 15** (handoff). The last live release gate is `docs/RELEASE_GATE.md`. Start here, then read `docs/HANDOFF.md`.

## Prerequisites

- Node.js 20+ (`.nvmrc` is 20)
- pnpm 9 (`corepack enable`)
- Docker + Docker Compose (Mongo 7 + Redis 7)
- Foundry (`anvil`) for replay and impact simulation
- Archive-capable **Base** RPC and an **Ethereum** RPC (Alchemy or QuickNode)
- Groq API key (`gsk_…`) only if you run the agent
- A browser wallet on Base 8453 if you test signing

## Setup

```bash
pnpm install
cp .env.example .env
```

Set at least:

```env
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<key>
```

Optional: `GROQ_API_KEY`, `SESSION_SECRET` (`openssl rand -hex 32`). Leave `DEFAULT_MIN_SAFETY_BUFFER_BPS` empty unless a product owner set it. Keep `ENABLE_AUTONOMOUS_MAINNET_EXECUTION=false`.

```bash
docker compose up -d mongodb redis
pnpm verify:contracts
pnpm dev
```

- Web: http://localhost:3000
- API live: http://localhost:4000/health/live
- API ready: http://localhost:4000/health/ready

Paste a Base address for read-only analysis. Connect + **Prove ownership** is required only for policy writes and transaction preparation.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | web + api + indexer + simulator |
| `pnpm lint` / `pnpm check-types` / `pnpm test` / `pnpm build` | static suite |
| `pnpm verify:contracts` | onchain bytecode of registry `moonwell-core-2026-08-16` |
| `pnpm chain:smoke` | live Base + Ethereum head + hash anchors |
| `pnpm moonwell:wallet <0x…>` | read real Moonwell Core positions/risk |
| `pnpm governance:sync` | ingest Ethereum proposals, decode Base CF effects |
| `pnpm fork:replay moonwell-176` | Anvil destination-effect replay + receipt |
| `pnpm replay:verify` | recompute moonwell-176 from committed anchors |
| `pnpm fork:strategies moonwell-176 [wallet]` | compare REPAY_DEBT and ADD_COLLATERAL |
| `pnpm fork:agent moonwell-176 [wallet]` | Groq agent over real tools (`GROQ_API_KEY`) |
| `pnpm --filter api start` | Nest API (`tsx`, not compiled JS) |
| `pnpm --filter simulator start` | BullMQ worker; owns Anvil |
| `pnpm --filter indexer start` | governance monitor loop |
| `pnpm test:e2e` | Playwright; add `RUN_WEB_E2E=1` for live UI → Anvil |

## Supported / not supported

Supported: Base 8453 Moonwell Core; Ethereum MultichainGovernor after MIP-X58; `_setCollateralFactor` as `DESTINATION_EFFECT_REPLAY`; REPAY_DEBT / ADD_COLLATERAL; Groq `openai/gpt-oss-120b` with `openai/gpt-oss-20b` fallback; user-signed allowlisted calls.

Not supported: other protocols, other change classes, Wormhole VAA replay, server-side sends, autonomous execution, a product safety-buffer default, email/Telegram.

## Docs

| Doc | Use |
|---|---|
| `docs/HANDOFF.md` | env by app, setup, deploy order, tests, replay, signing, what not to touch |
| `docs/RELEASE_GATE.md` | last live timings and receipt hash |
| `docs/PRD.md` / `docs/TECHNICAL_SPECIFICATION.md` | product + architecture |
| `docs/SECURITY_AND_THREAT_MODEL.md` | safety boundaries |
| `docs/ENVIRONMENT.md` | variable table |
| `docs/RUNBOOK.md` | local operations |
| `docs/KNOWN_LIMITATIONS.md` | honesty list |
| `docs/CONTRACT_REGISTRY.md` / `docs/PROTOCOL_RESEARCH.md` | addresses and sources |
