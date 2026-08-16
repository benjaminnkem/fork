# Implementation status

**Phase:** 7 — Groq agent orchestrator  
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
- Deterministic `matchExposure`: CF changes are relevant only when the wallet supplies the affected market as collateral.
- Versioned `UserRiskPolicy`. `DEFAULT_MIN_SAFETY_BUFFER_BPS` remains unset; a required buffer fails closed until a verified `safetyBufferBps` formula exists.
- Material-risk classification from Comptroller before/after liquidity and shortfall, including floored `liquidityDropBps`.
- Canonical receipt body + keccak hash. Anvil post-tx hashes are run evidence and are not hashed.
- Mongo schemas/indexes in `@fork/persistence` (no API/index migration wiring yet).
- CLI `pnpm receipt:reproduce [file]` re-runs the pinned replay and compares economic fields.
- `REPAY_DEBT` and `ADD_COLLATERAL` plans with exact ERC20 approvals, pause/cap/balance checks, and integer bounds.
- Every candidate amount is executed on a reset Anvil snapshot, then proposal 176 is applied, then Comptroller post-state is checked.
- `pnpm fork:strategies moonwell-176` compares both strategies. `--force-search-buffer` uses the measured post-change buffer + 1 so search is exercised without inventing a product default.
- Groq agent with `openai/gpt-oss-120b` and fallback `openai/gpt-oss-20b`. Tools are allowlisted, Zod-validated, and backed by the Phase 2–6 services. No solvency math or arbitrary txs.
- Production traces are user-safe summaries only. Hidden reasoning is not stored.
- CLI `pnpm fork:agent moonwell-176 [wallet]`. Live Groq tests are gated by `GROQ_API_KEY` and `RUN_AGENT=1`.

## Not done (by design)
- No Mongo/Redis/BullMQ wiring (Phase 8).
- No wallet connect or mainnet tx prep (Phase 9–10).

## Known limitations

See `docs/KNOWN_LIMITATIONS.md`.
