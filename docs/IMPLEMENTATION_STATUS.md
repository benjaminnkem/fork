# Implementation status

**Phase:** 4 — Anvil destination-effect replay  
**Date:** 2026-08-16

## Done

- Phase 0 research + skeleton.
- Phase 1 viem clients, anchors, registry bytecode checks.
- Moonwell Core read adapter on Base: `getAllMarkets`, `getAccountSnapshot`, `getAssetsIn`, `getAccountLiquidity`.
- Canonical risk from Comptroller only. Token amounts are `bigint`.
- CLI `pnpm moonwell:wallet <address>`.
- Live tests against a wallet discovered from real mUSDC transfers.
- Ethereum MultichainGovernor ingest via `getProposalData`/`state`/`proposalVotes`.
- Wormhole `publishMessage` payload decode to Base Temporal Governor calls.
- First supported change class: `_setCollateralFactor` on the Base Comptroller.
- Pinned historical event: proposal **176** (mwrsETH CF → 0.52e18).
- `pnpm governance:sync` writes normalized changes to `.data/governance-store.json`.
- DESTINATION_EFFECT_REPLAY of proposal 176: Anvil fork of Base `48025643` / `0x587e…e8bc`, impersonate Temporal Governor, exact `_setCollateralFactor` calldata, measure Comptroller risk.
- CLI `pnpm fork:replay moonwell-176`.

## Not done (by design)
- No Groq agent (Phase 7).
- No Mongo/Redis/BullMQ wiring (Phase 8).
- No wallet connect or mainnet tx prep (Phase 9–10).

## Known limitations

See `docs/KNOWN_LIMITATIONS.md`.
