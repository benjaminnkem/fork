# Implementation status

**Phase:** 14 — Full E2E / release gate  
**Date:** 2026-08-17  
**Report:** `docs/RELEASE_GATE.md`

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
- Mongo schemas/indexes in `@fork/persistence`. Nest/Mongoose connect and create indexes at API/simulator startup.
- CLI `pnpm receipt:reproduce [file]` re-runs the pinned replay and compares economic fields.
- `REPAY_DEBT` and `ADD_COLLATERAL` plans with exact ERC20 approvals, pause/cap/balance checks, and integer bounds.
- Every candidate amount is executed on a reset Anvil snapshot, then proposal 176 is applied, then Comptroller post-state is checked.
- `pnpm fork:strategies moonwell-176` compares both strategies. `--force-search-buffer` uses the measured post-change buffer + 1 so search is exercised without inventing a product default.
- Groq agent with `openai/gpt-oss-120b` and fallback `openai/gpt-oss-20b`. Tools are allowlisted, Zod-validated, and backed by the Phase 2–6 services. No solvency math or arbitrary txs.
- Production traces are user-safe summaries only. Hidden reasoning is not stored.
- CLI `pnpm fork:agent moonwell-176 [wallet]`. Live agent tests are gated by `GROQ_API_KEY` and `RUN_AGENT=1`.
- NestJS `/api/v1` public reads, queued impact simulations, reconnect-safe SSE, and proof/strategy endpoints.
- BullMQ `impact-simulation` worker in `apps/simulator`.
- Next.js product UI: paste any Base address, connect a wallet separately, load real Moonwell positions/risk, list relevant changes with source/destination status, launch simulations, stream SSE progress, show before/after, strategies, agent-empty/trace states, and proof receipts.
- Playwright covers the home/error paths. Live UI → API → Anvil flow is gated by `RUN_WEB_E2E=1`.
- Signed-nonce wallet authentication with expiry and replay protection. Read-only analysis stays public.
- `PUT /wallets/:address/policy` requires a session bound to that wallet.
- `POST /execution/prepare` rebuilds allowlisted REPAY_DEBT / ADD_COLLATERAL calls from live Moonwell state, dry-runs them on a current-head Anvil fork, and never accepts client calldata.
- `POST /execution/:id/register-tx` records a user-submitted hash, waits for the Base receipt, re-reads Comptroller state, and marks VERIFIED / PARTIAL / MISMATCH / FAILED.
- The UI shows exact target, method, amount, and spender before the user signs on Base 8453.
- Indexer poll loop persists Ethereum and Base cursors, detects reorgs, refreshes governor and destination CF status, marks stale/cancelled open simulations, and enqueues the pinned moonwell-176 impact job only for monitored wallets with relevant exposure.
- `GET /api/v1/monitoring` exposes index lag, last tick, reorg flags, and queue age. The UI shows lag and a wallet-level monitor toggle.
- Public replay manifest `replays/moonwell-176.json` stores identifiers and anchors only. `pnpm replay:verify` / `pnpm receipt:reproduce` recomputes the receipt from archive RPC + Anvil on a fresh checkout. It does not require a previously saved result file.
- Hardening: Anvil process-group cleanup, case-insensitive fork hashes, impact job schema checks, queue backpressure, 32kb JSON body limit, exact-approval only (no max uint), live bytecode check before prepare, untrusted user/tool data wrapping for Groq, and wallet-switch refusal in the execution UI.
- Phase 14 release gate executed from this checkout against live Base/Ethereum/Groq/Mongo/Redis/Anvil. No mocked chain or Groq data.
- `apps/api` now declares `express@5.2.1` so `pnpm --filter api start` resolves the 32kb body-parser import under pnpm isolation.
- Default `AGENT_TIMEOUT_MS` is 180000. A 90s budget timed out after five successful live tools.
- `pnpm fork:strategies moonwell-176 <wallet>` no longer treats the wallet as the scenario name.

## Not done (by design)
- Email/Telegram notifications are not added.
- Auto-simulation is limited to the pinned moonwell-176 DESTINATION_EFFECT_REPLAY. Other indexed changes refresh status/exposure only.
- No mainnet send is performed by the server or by automated tests.
- Autonomous mainnet execution stays off.
- `DEFAULT_MIN_SAFETY_BUFFER_BPS` is still unset; product owner must choose it.
- Phase 15 (final docs/deploy handoff) is not started.
- No hosted production deployment was exercised. Local `/health/ready` was green. Local `SESSION_SECRET` is still unset; production start refuses without it.

## Known limitations

See `docs/KNOWN_LIMITATIONS.md`.
