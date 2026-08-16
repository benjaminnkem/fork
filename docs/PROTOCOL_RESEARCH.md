# Protocol research — Phase 0

**Research date:** 2026-08-16  
**Status:** Sufficient to bootstrap. Governance event ABI and Temporal Governor trusted-sender topology remain Phase 3 work.

This file records primary-source facts. If official docs, repository comments, and onchain bytecode disagree, onchain executable behavior plus the official contracts page win over stale README text.

## 1. Product-relevant protocol

Fork V1 protects **Moonwell Core lending positions on Base Mainnet (8453)**. Moonwell Core is a Compound V2-compatible market system: mTokens + Comptroller. Canonical account safety is `Comptroller.getAccountLiquidity(account) → (error, liquidity, shortfall)` with USD values scaled to 18 decimals.

Sources:

- https://docs.moonwell.fi/moonwell/developers/protocol
- https://docs.moonwell.fi/moonwell/developers/protocol/comptroller/contract-interactions

Interest accrues per-second. Collateral requires an explicit `enterMarkets` membership. Business-logic failures often return error codes rather than revert.

## 2. Governance architecture after MIP-X58

Moonwell migrated primary governance from Moonbeam to Ethereum in May 2026 via MIP-X58.

Verified from:

- Official contracts page: Ethereum lists **Multichain Governor** `0x8769B70ac7c93AF0e75de0D69877709B66d75838`. Moonbeam lists **Multichain Governor (Sunset)** `0x9A8464C4C11CeA17e191653Deb7CdC1bE30F1Af4`.
- Forum monthly report, May 2026: MIP-X58 deployed/activated **MultichainGovernorV2** on Ethereum, added VotingPowerAggregator, proposal splitting, URI descriptions, and an execution window. First Ethereum-native proposal was MIP-E00 (id 169).
- `@moonwell-fi/moonwell-sdk@0.22.0` Ethereum environment sets `multichainGovernor` to the same Ethereum address.
- Onchain 2026-08-16: that address is an EIP-1967 proxy with implementation `0x78c504b6c0ea2adbf6a58b208c9888f3692db169` and non-empty bytecode.

Base remains a governed destination. Official docs and SDK agree on Temporal Governor `0x8b621804a7637b781e2BbD58e256a591F2dF7d51`. Onchain it has bytecode and is not an EIP-1967 proxy. `owner()` currently returns `0x446342af4f3bcd374276891c6bb3411bf2f8779e`. Phase 3 must identify that owner before any impersonated replay.

### Stale source (do not follow)

`moonwell-contracts-v2` README still says Multichain Governor is live on Moonbeam and is the source of truth. That comment predates MIP-X58. Do not implement a Moonbeam-source indexer as the current primary path.

Pinned repo head observed 2026-08-16: `7fa16481705934de0d92d78ce38395110e27e194` (MIP-X65 merge).

## 3. Read-path contracts (Base)

Cross-checked official docs vs SDK 0.22.0 vs bytecode:

| Role | Address | Docs | SDK 0.22.0 | Bytecode 2026-08-16 |
|---|---|---|---|---|
| Comptroller / Unitroller | `0xfBb21d0380beE3312B33c4353c8936a0F13EF26C` | yes | yes | 1412 bytes; `comptrollerImplementation()` = `0x73d8a3bf62aaca6690791e57ebaee4e1d875d8fe` |
| Temporal Governor | `0x8b621804a7637b781e2BbD58e256a591F2dF7d51` | yes | yes | 8658 bytes |
| Vote collection | `0xe0278B32c627FF6fFbbe7de6A18Ade145603e949` | yes | yes | EIP-1967 → `0x9d465d56d235674693a158af40c8d53dde59b0ce` |
| Chainlink oracle | `0xEC942bE8A8114bFD0396A5052c36027f2cA6a9d0` | yes | yes | 4025 bytes |
| mUSDC | `0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22` | yes | n/a here | 7544 bytes |
| mWETH | `0x628ff693426583D9a7FB391E54366292F509D457` | yes | n/a here | 7544 bytes |

### Non-blocking disagreement

Official docs Moonwell Views = `0x6834770aba6c2028f448e3259ddee4bcb879d459`.  
SDK 0.22.0 Views = `0x821Ff3a967b39bcbE8A018a9b1563EAf878bad39`.

V1 canonical risk does **not** use Views. Comptroller `getAccountLiquidity` is ground truth. Do not pick a Views address until Phase 2 re-verifies if a helper is needed.

## 4. Replay implications

Faithful `FULL_REPLAY` of Ethereum → Wormhole → Base Temporal Governor is not required for V1. Preferred V1 grade is `DESTINATION_EFFECT_REPLAY` of the exact Base target calls from the authorized Base execution context, clearly labeled. Impersonation is Anvil-only.

Phase 3/4 must still:

1. Decode MultichainGovernorV2 events from the Ethereum implementation ABI.
2. Reconstruct destination calls without guessing unknown selectors.
3. Confirm Temporal Governor trusted senders / owner before impersonation.
4. Fail closed if the Base effect cannot be reconstructed.

## 5. Groq

Checked https://console.groq.com/docs/models and https://console.groq.com/docs/deprecations on 2026-08-16:

- Planner: `openai/gpt-oss-120b` (production).
- Fallback: `openai/gpt-oss-20b` (production).
- `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` shut down for free/developer usage on 2026-08-16. Do not use them.

## 6. Phase 2 read-path verification

On 2026-08-16, live Base reads confirmed:

- `markets(address)` returns `(bool isListed, uint256 collateralFactorMantissa)` only, matching official docs and not the 3-field Compound V2 struct.
- `getAccountSnapshot` / `getAccountLiquidity` / `getAllMarkets` / `getAssetsIn` decode as documented.
- `getAllMarkets()` returned 21 markets.
- Wallet `0x416ec2ca21a38cbcfeacd6a14532b3f348356d23` was discovered from `alchemy_getAssetTransfers` on mUSDC (`0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22`), sample tx `0x16413fd18b300897960ff7492ba497bdc0a90679632f40f816f7f04f5403f86e`. Snapshot showed a non-zero mUSDC balance and Comptroller liquidity with `error=0`, `shortfall=0`.

Alchemy free-tier `eth_getLogs` is limited to a 10-block range. Discovery used `alchemy_getAssetTransfers` instead.

## 7. Phase 3 governance verification

Verified 2026-08-16 on Ethereum governor `0x8769B70ac7c93AF0e75de0D69877709B66d75838`:

- `proposalCount() = 182`
- IDs `< 169` exist but have empty `getProposalData` and `state = 6` (treated as `EXPIRED` / pre-migration placeholders)
- Working views: `state`, `getProposalData(address[],uint256[],bytes[])`, `proposalVotes`, `liveProposals`, `votingPeriod=259200`, `crossChainVoteCollectionPeriod=86400`, `quorum`, `proposalThreshold`
- `proposalInformation` reverts on this ABI; not used
- Governor actions that affect Base are not raw Comptroller calls. They are Wormhole `publishMessage` (`0xb19a437e`) to core `0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B`
- Payload ABI is `(address temporalGovernor, address[] targets, uint256[] values, bytes[] calldatas)`
- Base Temporal Governor `proposalDelay() = 86400`
- Observed governor `state` values: `2` cancelled, `5` executed, `6` empty/expired. Mapped 0=PROPOSED, 1=APPROVED (cross-chain vote collection), 2=CANCELLED, 3=UNKNOWN (defeated), 4=APPROVED, 5=EXECUTED, 6=EXPIRED

Pinned V1 change: **proposal 176**, executed (`state=5`). Destination batch to Base Temporal Governor `_setCollateralFactor(0xfC41B49d064Ac646015b459C522820DB9472F4B5, 520000000000000000)` on Comptroller `0xfBb21d0380beE3312B33c4353c8936a0F13EF26C` (mwrsETH → 52%). Related later CF updates: 175 set 68%, 179 set 46% (current onchain CF).

Support level: `DESTINATION_EFFECT_REPLAY`. Destination queue/execute logs are not required to reconstruct the Base economic effect.

## 8. Phase 4 replay pin

Proposal 176 Base execution was located by binary-searching `markets(mwrsETH)` over archive state:

- Before: block `48025643` hash `0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc` CF `0.68e18`
- After: block `48025644` hash `0x76af174fa79a4cf9cd8a78a57c7bf2776c254ebd39f01ab5576a66ffc777416c` CF `0.52e18`
- Later 179: block `49239739` CF `0.46e18`

Comptroller `admin()` is Temporal Governor `0x8b621804a7637b781e2BbD58e256a591F2dF7d51`.

Real mwrsETH supplier at the pre-event block (from `alchemy_getAssetTransfers` + `getAccountSnapshot`): `0x9eec3976435a37b0340ecbd966c226a691956b35` (entered as collateral, non-zero liquidity, shortfall 0). Isolated single-market wallet also observed: `0x494c7fdb753c15b69fea2293e1b76567ca94462d`.

## 9. Phase 6 rescue wallets (block 48025643)

Verified with `balanceOf` + `getAccountSnapshot` + Comptroller pause reads:

- Impact wallet `0x9eec3976435a37b0340ecbd966c226a691956b35`: mwrsETH collateral + USDC debt; USDC/wrsETH wallet balances are 0. Rescue infeasible without minting.
- Isolated wallet `0x494c7fdb753c15b69fea2293e1b76567ca94462d`: mwrsETH supply+borrow; USDC wallet balance `100236208`. mUSDC mint is not paused. ADD_COLLATERAL candidate.
- `0x416ec2ca21a38cbcfeacd6a14532b3f348356d23`: EURC debt with EURC wallet balance `489012`. REPAY_DEBT asset exists, but the wallet has no mwrsETH exposure to proposal 176.
- `mintGuardianPaused(mwrsETH)` is true at the fork block.

## 10. Open later-phase questions

- Exact MultichainGovernorV2 event/ABI surface on implementation `0x78c5…b169`.
- Temporal Governor trusted-sender set and proposal delay after MIP-X58.
- First end-to-end supported historical risk-parameter change (proposal id, txs, affected market). Do not invent one in Phase 0.
