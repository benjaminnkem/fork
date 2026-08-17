# Release gate — 2026-08-17

Phase 14 full E2E/release gate from this checkout. No mocked Base, Ethereum, Moonwell, or Groq data.

## Identity

| Item | Value |
|---|---|
| Date | 2026-08-17 |
| Starting commit | `45a5acf438a6bf79e5dc3f00c2a44ab2b2824b64` (`fix: harden Anvil cleanup, job validation, and untrusted agent data`) |
| Checkout fixes | declare `express@5.2.1` on `apps/api`; default `AGENT_TIMEOUT_MS=180000`; `fork-strategies` wallet/scenario parse |
| Registry | `moonwell-core-2026-08-16` |
| Node | 24.11.0 |
| pnpm | 9.0.0 |
| Anvil | 1.7.1 |
| Replay | `DESTINATION_EFFECT_REPLAY` moonwell-176, Base fork `48025643` / `0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc` |
| Isolated wallet | `0x494c7fdb753c15b69fea2293e1b76567ca94462d` |
| Historical impact wallet | `0x9eec3976435a37b0340ecbd966c226a691956b35` |

## Environment

Set and used: `BASE_RPC_URL`, `ETHEREUM_RPC_URL`, `GROQ_API_KEY`, `MONGODB_URI`, `REDIS_URL`.

Unset: `SESSION_SECRET` (local only; production start refuses). `DEFAULT_MIN_SAFETY_BUFFER_BPS` remains unset by product decision.

Local infra: `fork-mongodb-1` and `fork-redis-1` healthy. Snapshot after the live stack: Mongo 301.1MiB, Redis 18.59MiB.

## Timings

| Step | Result | Time |
|---|---|---|
| `pnpm install --frozen-lockfile` | pass | 4.2s |
| `pnpm lint` | pass | 25.1s |
| `pnpm check-types` | pass | 37.6s |
| `pnpm test` | pass | 23.9s |
| `pnpm verify:contracts` | 8/8 ok | 8.1s |
| `pnpm chain:smoke` + `moonwell:wallet` + `governance:sync` | pass | 25s wall for the trio; sync 4656ms |
| `pnpm replay:verify` | 11/11 anchors, action match | 12.87s |
| `pnpm fork:strategies moonwell-176` | change-only passes | 10.75s |
| `pnpm fork:strategies moonwell-176 --force-search-buffer` | ADD_COLLATERAL verified | 170.49s |
| `RUN_AGENT=1 pnpm fork:agent` (default 90s) | `AGENT_TIMEOUT` after 5 real tools | 99.05s |
| `RUN_AGENT=1 AGENT_TIMEOUT_MS=240000 pnpm fork:agent` | COMPLETED on `openai/gpt-oss-120b` | 34.12s |
| allowlist unit tests | 3/3 | 1.48s |
| `RUN_API_E2E=1` simulations e2e | COMPLETED + SSE | 6.24s (961ms test; idempotent completed run) |
| `RUN_WEB_E2E=1 pnpm test:e2e` | 4/4 including live UI | 11.47s (live path 3.5s) |
| `/health/live` + `/health/ready` | `ok`; Mongo, Redis, Base 8453, Ethereum 1, Groq configured | <1s |
| Anvil after CLI + E2E + SIGTERM of API/simulator | none | — |

## Chain evidence

- Contract registry bytecode: 8/8 ok.
- Base latest 50101950 / safe 50101914. Ethereum latest 25776758 / safe 25776704.
- Isolated wallet: 1 mwrsETH position, risk SAFE, shortfall 0 at safe 50101939. Live CF 0.46e18 after later proposals (176 target was 0.52e18).
- Governance sync incremental `fromProposal` 182 → 182, upserted 1, no reorg. Pinned 176 remains `COLLATERAL_FACTOR_CHANGE` / `DESTINATION_EFFECT_REPLAY`. File-store destination status can still read `DESTINATION_PENDING` while live CF has already moved.

## Replay / receipt

`pnpm replay:verify` recomputed from `replays/moonwell-176.json` (identifiers and anchors only).

- 11 anchors ok (governor, comptroller, temporal governor, fork hash, dest-effect hash, bytecode, market, after CF 0.52e18, before CF 0.68e18).
- Wallet `0x9EEC3976435A37b0340eCBD966C226a691956B35` stayed SAFE → SAFE.
- Class `LIQUIDITY_REDUCED`. `liquidityDeltaRaw` `-4744214316656587094505`. shortfall delta 0.
- Receipt hash `0xcf47d2732a3055af754dc902be2c8a5963516ddf599edddd2d35857f5111d0b9`.

## Strategies

Default policy (`NO_ADDITIONAL_BUFFER` / 0 bps) on `0x494c…462d`:

- change-only passed; measured buffer 2092 bps.
- `REPAY_DEBT` `INFEASIBLE` / `NO_REPAY_ASSET_AT_ANCHOR`.
- `ADD_COLLATERAL` `NOT_REQUIRED`.

`--force-search-buffer` (2093 bps explicit, measured + 1):

- `REPAY_DEBT` still infeasible.
- `ADD_COLLATERAL` `VERIFIED` at `amountRaw` `35`, bound `100236208`, 27 probes, 5 rejected, 22 verified.

Allowlist: adapter-built repay accepted; unlimited approval rejected; arbitrary calldata rejected.

## Agent

First live CLI run used `get_wallet_positions`, `get_change_details`, `get_exposure`, `run_impact_simulation`, `list_available_rescue_assets`, then `AGENT_TIMEOUT` at the 90s default.

Retry with `AGENT_TIMEOUT_MS=240000` completed in 34.12s on `openai/gpt-oss-120b`. Tools: positions, exposure, impact simulation, rescue assets, `compare_verified_strategies`. `REPAY_DEBT` rejected infeasible. Recommendation: no rescue required. User summary has no `<think>` / hidden reasoning. No `send_transaction` tool exists.

Default timeout raised to 180000 after that measurement.

## API / UI

- `pnpm --filter api start` failed until `express@5.2.1` was declared (main.ts imports `json`/`urlencoded` for the 32kb limit; pnpm does not hoist Nest's copy).
- After the fix, API listened on 4000. Ready checks: Mongo ok, Redis ok, Base 8453, Ethereum 1, Groq configured.
- API e2e queued/streamed the isolated-wallet moonwell-176 job and served proof. The 961ms duration is an idempotent COMPLETED replay of a prior real run, not a fresh Anvil fork.
- Playwright: home has no fake figures; invalid address stays on the form; unknown wallet rejected; live path pasted `0x494c…462d`, loaded positions, launched simulation, saw exact `COMPLETED`, opened proof.

## Shutdown

API and simulator were SIGTERM'd after the live stack tests. `pgrep anvil` was empty before E2E, after E2E, and after shutdown. A host `kill -9` of Node can still leave an Anvil child; that remains a known limitation.

## Remaining limits

See `docs/KNOWN_LIMITATIONS.md`. Material leftovers:

- Replay is destination-effect impersonation, not a full Wormhole VAA.
- `DEFAULT_MIN_SAFETY_BUFFER_BPS` is unset. Policy receipts record `NO_ADDITIONAL_BUFFER`.
- Pinned historical wallet has no rescue inventory at the fork block.
- No automated mainnet send. Autonomous execution stays off.
- Local `SESSION_SECRET` unset. Do not deploy production until it is set.
- File-store destination status can lag later CF moves.
- Performance SLOs in the spec were not re-baselined as a formal p50/p95 study this gate; timings above are single-run measurements.

## Verdict

Phase 14 release gate is **green** for the locked V1 scope on this machine. Next phase is Prompt 15: final documentation, deployment order, and handoff. Do not enable autonomous execution or invent a safety-buffer default before a product-owner decision.
