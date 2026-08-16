# Fork — Product Requirements Document (PRD)

**Product:** Fork  
**Version:** 1.0 / Hackathon-to-Production V1  
**Prepared:** 2026-08-15  
**Primary network:** Base Mainnet  
**Initial protocol adapter:** Moonwell Core lending  
**Status:** Build specification

---

## 1. Executive summary

Fork is an autonomous DeFi pre-execution risk agent that lets a user's money experience an already-known protocol future **before the real chain does**.

DeFi positions are not only exposed to price movement. They are also exposed to protocol-state changes: governance can change collateral factors, liquidation parameters, caps, interest models, supported markets, oracle implementations, or other configuration. A wallet may look healthy at the current block while a passed, queued, scheduled, or otherwise authoritative future state transition will materially reduce its safety shortly afterward.

Fork continuously discovers supported protocol changes, determines whether a particular wallet is actually exposed, creates a controlled fork of the real chain, applies the upcoming change, reads the user's resulting risk from the real protocol contracts, and—if the position violates the user's safety policy—searches for rescue actions. Rescue candidates are not trusted because an LLM suggested them. Each candidate is executed in a separate counterfactual branch, re-evaluated using protocol contracts, and only marked verified if deterministic invariants pass.

The first adapter supports Moonwell Core lending on Base Mainnet. Moonwell is chosen because it provides real lending positions, governance-controlled risk parameters, active governance, public contracts, and a Base deployment. The architecture must treat Moonwell as Adapter #1, not as Fork's identity.

### One-line pitch

> **Fork executes upcoming protocol changes against your position before the blockchain does, then finds and proves the safest action you can take now.**

### Core principle

> **The model proposes. The EVM proves.**

---

## 2. Problem statement

### 2.1 The user problem

A DeFi borrower can understand the current state of a position and still be blindsided by a protocol rule change. To protect themselves manually, they would need to:

1. know every protocol they are exposed to;
2. monitor authoritative governance across the relevant source and destination chains;
3. distinguish discussion from an executable/queued change;
4. decode proposal actions and cross-chain execution payloads;
5. identify which actions matter to their exact assets/markets;
6. reconstruct their position at a suitable block;
7. simulate the future protocol configuration;
8. measure before/after solvency using the protocol's own contracts;
9. derive possible interventions;
10. calculate how much action is actually required;
11. test every candidate under the changed state;
12. act before the real change executes.

This is unreasonable for ordinary users and operationally expensive even for sophisticated users.

### 2.2 Why existing wallet diagnostics are insufficient

Most wallet-risk products answer questions about **current state**: approvals, concentration, token risk, health factor, current liquidation exposure, or current prices.

Fork addresses a separate question:

> **Which already-known future protocol changes can alter my position, and what should I do before they land?**

Fork is not a token research agent, generic portfolio analyzer, price predictor, governance summarizer, or liquidation bot.

---

## 3. Product thesis

The exact future market price is unknowable. A governance payload that has already been created, approved, queued, or scheduled can be much more deterministic.

Fork therefore separates two kinds of uncertainty:

- **Known protocol transition:** an authoritative future contract action can often be decoded and executed exactly in a fork.
- **Unknown market evolution:** prices, other users' transactions, liquidity, interest accrual, and unrelated state may change before execution.

Fork V1 must not claim to know “tomorrow's exact blockchain.” It computes a **counterfactual protocol future anchored to a real block**: “If this known protocol transition were applied to this wallet's current/pinned state, what changes?”

Optional scenario shocks can be added later, but the deterministic governance transition must remain clearly separated from assumptions.

---

## 4. Target users

### Primary user: active DeFi borrower

A user with collateral and debt in a supported Moonwell Core lending market on Base who wants advance warning when governance changes their risk.

Needs:

- low-friction wallet/address analysis;
- precise explanation of why a change matters;
- deterministic proof;
- quantified intervention options;
- ability to prepare/sign a rescue transaction.

### Secondary user: treasury/operator

A DAO, fund, protocol treasury, or power user monitoring several addresses.

Needs:

- multi-wallet monitoring;
- queue-safe/scalable processing;
- reproducible evidence;
- alerts and audit history;
- policy-driven safety thresholds.

### Future user: autonomous wallet/agent platform

An agent marketplace or autonomous wallet can use Fork as a pre-execution or pre-governance risk tool.

This is not required for V1.

---

## 5. V1 scope

### 5.1 In scope

1. Base Mainnet read-only wallet analysis.
2. Moonwell Core lending position discovery.
3. Current Moonwell governance discovery using the authoritative architecture verified at implementation time.
4. Ethereum Mainnet governance monitoring when Moonwell's primary governor is on Ethereum.
5. Base Temporal Governor / destination execution monitoring where relevant.
6. Protocol-change normalization.
7. Wallet-to-change exposure matching.
8. Confidence/status classification (discussion/active/succeeded/queued/executable/executed/cancelled as supported by actual architecture).
9. Real Base Mainnet fork creation with Anvil at a pinned block number and block hash.
10. Exact or faithfully reconstructed destination-side governance effect replay.
11. Before/after Moonwell account-risk measurement from real contracts.
12. Material-risk detection.
13. Two bounded strategy classes:
    - repay debt;
    - add collateral.
14. Deterministic amount optimization for each supported strategy.
15. Independent branch simulation and verification.
16. Verified strategy ranking according to user policy.
17. Evidence/proof receipt.
18. Human-readable agent trace made of application-level decision summaries and tool evidence.
19. Read-only wallet address mode.
20. Connected-wallet mode using wagmi/viem.
21. User-signed Base Mainnet transaction preparation for supported rescue actions.
22. Continuous governance polling/indexing.
23. Reproducible historical replay only if backed by real chain data.

### 5.2 Out of scope for V1

- arbitrary DeFi protocols;
- arbitrary chains;
- autonomous custody/private-key management;
- unrestricted delegated mainnet execution;
- generic swaps across arbitrary DEXs;
- flash-loan rescue;
- cross-chain refinancing;
- arbitrary leverage unwind;
- price prediction;
- generic “AI financial advice”;
- liquidation execution;
- insurance;
- DAO voting;
- governance transport reliability simulation unless explicitly implemented and verified;
- support for a proposal whose Base-side effect cannot be decoded/replayed safely;
- browser automation to move funds;
- any feature that depends on mocked external responses.

---

## 6. Moonwell's role

Moonwell is Fork's first protocol adapter. It provides three things:

1. **Current user state:** Moonwell Core lending markets and the Comptroller expose the user's collateral/borrow state and protocol risk checks.
2. **Future protocol events:** Moonwell governance can modify protocol configuration; current governance is multichain and must be discovered/verified from official contracts and repositories.
3. **Ground truth after simulation:** the same Moonwell contracts on the Base fork are queried again after the change and after rescue candidates.

Fork must never be branded as “a Moonwell tool.” Code must expose a protocol-adapter interface so future adapters can support Aave, Compound, Morpho, or other EVM protocols.

---

## 7. Primary user journeys

### Journey A — analyze without connecting a wallet

1. User pastes a Base address.
2. Fork validates the address and network.
3. Backend reads real Base Mainnet Moonwell positions.
4. UI displays supported positions and current risk.
5. Fork loads relevant discovered protocol changes.
6. If no supported change affects the wallet, UI states exactly that and lists the scope checked.
7. If a change is relevant, user can run impact simulation.

No authentication is required for public onchain analysis.

### Journey B — live relevant-change detection

1. Governance indexer ingests an authoritative Moonwell proposal/action.
2. Change normalizer determines targets, calldata, affected markets/assets, status, and execution semantics.
3. Exposure matcher finds monitored wallets using the affected market/assets.
4. For each matched wallet, Fork creates an impact-simulation job.
5. Simulator pins the Base block/hash and records baseline risk.
6. Simulator applies the exact supported Base-side effect.
7. Moonwell risk is read again.
8. If the user's policy remains satisfied, event is recorded as safe/no action.
9. If policy is violated or materially degraded, the agent is invoked to select strategy classes.
10. Deterministic optimizers find viable amounts.
11. Candidate strategies are simulated independently.
12. Only verified candidates are shown/ranked.

### Journey C — rescue planning

1. Fork discovers a material future-risk state.
2. User policy is loaded; default policy is conservative and explicitly documented.
3. Agent sees only bounded tools and verified state facts.
4. Agent selects one or more supported strategy classes.
5. For `REPAY_DEBT`, deterministic search finds the minimum amount that satisfies policy, subject to available wallet assets and protocol constraints.
6. For `ADD_COLLATERAL`, deterministic search finds the minimum available collateral amount that satisfies policy.
7. Every candidate branch executes relevant approvals/actions plus governance change in the correct order.
8. Post-state is verified through Moonwell contracts.
9. Valid plans are ranked by selected objective: minimum capital, maximum safety, or minimum transaction count.

### Journey D — mainnet execution

1. User connects a wallet.
2. Fork re-reads current mainnet state immediately before preparation.
3. Fork checks that the governance event is still relevant/not cancelled/executed unexpectedly.
4. Fork re-simulates against a fresh safe/finalized anchor if prior simulation is stale.
5. Backend creates a narrow transaction plan using allowlisted Moonwell contract methods.
6. Frontend shows exact calls, token amounts, approvals, spender addresses, expected post-state, and simulation proof.
7. User explicitly confirms.
8. User wallet signs/sends; backend never receives the private key.
9. Fork waits for receipt, verifies chain ID and success, then re-reads Moonwell position and records actual post-state.
10. If the onchain post-state differs materially from simulation, surface a high-severity incident and do not claim success.

### Journey E — historical replay

Historical replay exists to reproduce real past protocol changes when no suitable live event is pending.

Requirements:

- real historical Base block number + hash;
- real deployed Moonwell contracts at that block;
- real governance proposal/action and exact effect;
- real authoritative transaction/log evidence;
- preferably a real historical wallet position present before execution;
- no synthetic “this user would be liquidated” outcome.

If no real wallet materially affected by the chosen event can be found, the replay may demonstrate a real safety-buffer delta, but must say so. Do not manufacture a vulnerable position merely to make the demo dramatic.

---

## 8. Governance-event confidence model

The adapter must derive statuses from the actual Moonwell governance architecture, not generic labels alone. Product copy should map internal statuses to user-facing confidence.

Suggested semantic levels:

| Level | Meaning | Product behavior |
|---|---|---|
| Advisory | Official forum/risk recommendation only | Optional early-warning analysis; never “scheduled” |
| Proposed | Authoritative proposal exists but is not approved | Simulate as conditional scenario |
| Approved | Proposal passed authoritative governance | High-confidence impact preview |
| Queued/Scheduled | Destination action/timelock exists with known earliest execution | Critical pre-execution warning |
| Executable | Timelock/conditions satisfied but not yet executed | Urgent warning |
| Executed | Current state | Re-baseline; no longer a future event |
| Cancelled/Expired | Will not execute under current proposal | Clear alert and stop rescue recommendation |

Because Moonwell migrated its primary governance to Ethereum in 2026 while retaining cross-chain execution infrastructure, the adapter must represent source-governance state separately from Base destination-execution state.

---

## 9. Functional requirements

### FR-1 Wallet discovery

- Accept any valid Base EOA or smart-account address.
- Read supported Moonwell Core positions from Base Mainnet.
- Preserve raw integer values; never use JS floating point for token/accounting amounts.
- Store block number/hash and RPC provider used.
- Handle no-position wallets cleanly.

### FR-2 Governance discovery

- Poll/index authoritative contracts on the correct source/destination chain(s).
- Backfill from configured start blocks.
- Be reorg-aware.
- Normalize each supported action to a typed `ProtocolChange`.
- Store raw logs/transaction hashes and decoded evidence.
- Never infer a callable governance action solely from forum prose.

### FR-3 Change decoding

- Decode target, calldata, value, intended destination, affected market, change type, old state, proposed new state, and execution status where deterministically possible.
- Unknown calls must be represented as unsupported/unknown, not guessed.
- New function selectors require explicit adapter support and tests before production simulation.

### FR-4 Exposure matching

- Determine whether a wallet's supported position can be affected by a normalized change.
- Avoid LLM use when deterministic asset/market matching is possible.
- Explain matching evidence.

### FR-5 Fork creation

- Create isolated Anvil forks of Base Mainnet.
- Pin source block number and hash.
- Enforce a simulation timeout.
- Limit concurrent forks.
- Clean up child processes after success/failure/cancellation.
- Never expose Anvil RPC publicly.

### FR-6 Change replay

- Prefer faithful execution through the real destination governance execution path when feasible.
- If exact cross-chain transport cannot be replayed, V1 may execute the exact destination effect using an impersonated authorized execution context **only inside Anvil** and must label the receipt `DESTINATION_EFFECT_REPLAY`, not `FULL_GOVERNANCE_REPLAY`.
- Validate that the target bytecode/code hash and current preconditions match expectations.
- Never impersonate privileged accounts on mainnet.

### FR-7 Risk measurement

- Read canonical Moonwell risk/account-liquidity state before and after changes.
- Contract-derived risk beats LLM/math estimates.
- Derived USD/UI values must include pricing source/block metadata.

### FR-8 Strategy search

- Agent may choose among allowlisted strategy classes only.
- Strategy parameters/amounts must be optimized deterministically.
- Strategy feasibility must check wallet asset availability, allowances/approval path, market entry requirements, protocol pause state, caps, and current event status.

### FR-9 Verification

A strategy may be `VERIFIED` only if:

- every simulated transaction succeeds;
- expected Moonwell state transition occurs;
- post-change shortfall/solvency is acceptable;
- configured safety policy passes;
- no forbidden call/contract is used;
- required balance/allowance assumptions are satisfied;
- branch evidence is persisted.

### FR-10 Proof receipt

Every completed impact/strategy simulation must persist a reproducible receipt containing:

- chain IDs;
- fork block numbers and hashes;
- proposal/change identifier;
- source/destination transaction/log references;
- target addresses;
- code hashes where practical;
- calldata and values;
- decoded action;
- before state;
- after-change state;
- strategy calls;
- post-strategy/post-change state;
- invariant results;
- timestamps;
- engine/app version;
- canonical receipt hash.

### FR-11 Agent trace

Expose user-safe trace events such as observation, decision summary, tool call, tool result, strategy rejected, strategy verified, and final selection.

Do not display raw hidden chain-of-thought from the model.

### FR-12 Transaction preparation

- Build only allowlisted transaction plans.
- Never expose a model tool that accepts arbitrary `to/data/value` for mainnet execution.
- Use exact/bounded token approvals where possible; do not default to unlimited allowance.
- Re-simulate immediately before signing if state/event has changed or simulation has expired.

### FR-13 Continuous monitoring

- Periodic governance synchronization.
- Resume from last indexed block after restart.
- Idempotent event ingestion.
- Re-evaluate monitored wallets only when affected.
- Backpressure/rate-limit simulation jobs.

---

## 10. Non-functional requirements

### Reliability

- Idempotent jobs.
- Exponential backoff for transient RPC/Groq failures.
- Explicit terminal states for unsupported/reverted/stale/cancelled simulations.
- No silent fallback from real data to fabricated data.

### Scalability

- API, governance indexer, and simulation workers must scale separately.
- Simulation workloads must be queue-based.
- Mongo indexes designed for wallet/change/status queries.
- Redis/BullMQ controls concurrency and backpressure.
- Stateless API instances where possible.

### Security

- No server-side wallet private keys.
- No production secrets in browser bundles/logs.
- No public Anvil endpoints.
- Tool allowlists.
- Address/function allowlists for mainnet-prepared calls.
- Untrusted proposal descriptions treated as data, never instructions.
- Request throttling and wallet-analysis abuse controls.

### Performance targets for V1

These are goals, not excuses to fake results:

- cached wallet-position response: < 1.5s p95;
- fresh supported wallet-position read: < 4s p95 under normal RPC conditions;
- governance sync interval: 30–60s by default;
- initial impact simulation: target < 30s p95;
- each additional strategy branch: target < 20s p95;
- UI must stream progress rather than block silently.

### Observability

- structured logs with request/job/simulation/agent correlation IDs;
- queue depth and processing duration metrics;
- RPC error/rate-limit metrics;
- Groq usage/rate-limit metrics;
- Anvil spawn/cleanup metrics;
- alert on orphaned fork processes.

---

## 11. Product safety and financial-language requirements

Fork is a risk-analysis/execution-assistance product, not a guarantee against liquidation and not an oracle of exact future market conditions.

Every risk result must distinguish:

- facts read from chain;
- exact simulated governance transition;
- user-configured policy;
- optional assumptions/scenarios;
- AI-generated hypotheses;
- deterministic verification result.

Never use “guaranteed safe.” Prefer “verified under the simulated state and stated assumptions.”

---

## 12. Edge cases that must be handled

1. Wallet has no Moonwell position.
2. Wallet is a smart contract/account-abstraction address.
3. Position contains unsupported market.
4. Governance proposal affects unrelated asset.
5. Proposal is cancelled after simulation.
6. Proposal expires.
7. Proposal changes before finalization.
8. Source-governance action passes but destination message is not yet queued.
9. Cross-chain transport/payload cannot be deterministically reconstructed.
10. Target contract implementation changed between proposal creation and replay anchor.
11. Contract is upgraded before execution.
12. Oracle price changes between baseline and action.
13. Interest accrues between simulations.
14. User changes position while simulation is running.
15. User's available rescue asset disappears/moves.
16. ERC20 approval is needed.
17. Token has nonstandard behavior.
18. Transaction reverts on fork.
19. RPC provider returns inconsistent archive data.
20. Base block reorg/provisional event.
21. Ethereum governance reorg/provisional event.
22. Groq model returns malformed tool call.
23. Model repeatedly asks for invalid tools.
24. Groq free-tier rate limit is reached.
25. Anvil process crashes or hangs.
26. Server restarts mid-simulation.
27. Duplicate event/job arrives.
28. Two rescue transactions compete for same wallet nonce.
29. User switches wallet/network before signing.
30. Mainnet state differs from simulation at signing time.
31. Gas estimate changes significantly.
32. Change improves, rather than worsens, position.
33. Change reduces safety but does not violate policy.
34. Multiple simultaneous proposals affect same market.
35. One proposal contains several Base actions.
36. Proposal contains unsupported function selector.
37. Protocol is paused.
38. Market is deprecated.
39. Supply/borrow cap prevents proposed rescue.
40. Moonwell governance architecture changes again.

Unknown critical semantics must fail closed and be surfaced to the user/developer rather than guessed.

---

## 13. UX requirements

### Main dashboard

- address input and connect-wallet CTA;
- supported positions;
- current safety state;
- relevant governance events;
- event confidence/status;
- “simulate impact” action;
- clear unsupported-state messaging.

### Simulation view

Stream:

1. anchor block selected;
2. position loaded;
3. governance action decoded;
4. Base fork started;
5. baseline captured;
6. change replayed;
7. post-change risk measured;
8. strategies considered;
9. strategy branches verified;
10. recommendation/proof ready.

### Proof view

Must show technical provenance without requiring the user to trust the prose explanation.

### Execution review

Must show exact calls, contract names/addresses, token amounts, approvals, and expected post-state before wallet signing.

---

## 14. Success metrics

Hackathon/product V1 success is measured primarily by correctness and reproducibility:

- percentage of supported changes decoded successfully;
- percentage of simulations reproducible from receipts;
- false-positive relevant-change rate;
- simulation success rate;
- number of verified strategy candidates per risky event;
- time from relevant governance detection to completed impact analysis;
- zero fabricated states/transactions;
- zero server-side custody incidents.

---

## 15. Acceptance criteria

V1 is accepted only when all of the following are true:

1. A real Base Mainnet address with a Moonwell Core position can be analyzed from public chain state.
2. The implementation can discover at least one real Moonwell governance/risk action from authoritative sources.
3. The current Moonwell source-governance and Base execution architecture is documented with verified contract addresses and source references.
4. A real Base fork can be pinned and reproduced.
5. A supported real governance effect can be applied to that fork.
6. Moonwell account risk is measured before/after using real deployed contracts.
7. At least one real event produces a material, reproducible risk delta for a real historical/current wallet; if it does not cause insolvency, the UI does not pretend it does.
8. `REPAY_DEBT` is optimized and verified through fork execution.
9. `ADD_COLLATERAL` is optimized and verified through fork execution when the wallet has a suitable asset.
10. Invalid/insufficient strategy amounts are deterministically rejected.
11. The agent can choose tools/strategy classes but cannot bypass deterministic checks.
12. Every displayed numeric result is traceable to chain data or explicit derived math with provenance.
13. A proof receipt can reproduce the simulation.
14. Mainnet transaction preparation uses only allowlisted calls and requires wallet signature.
15. E2E tests exercise the real API → queue → Anvil → Base archive RPC path.
16. No acceptance path uses mocked RPC/Moonwell/governance/Groq results.
17. Production startup validates required env/config and refuses unsafe defaults.
18. Documentation explains setup, env vars, run commands, test commands, supported scope, and known limitations.

---

## 16. Future roadmap

After V1 correctness is proven:

- additional Moonwell change classes;
- Aave/Compound/Morpho adapters;
- scenario overlays for price/liquidity shocks;
- multi-wallet organizations;
- notifications;
- policy-based delegated execution with smart accounts/session keys;
- agent-marketplace integration;
- protocol-level risk feeds/APIs;
- transport-level cross-chain governance simulation;
- continuous “future exposure” API for wallets/agents.

Do not build roadmap items until V1 acceptance criteria are green.
