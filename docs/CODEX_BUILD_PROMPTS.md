# Fork — Ordered Codex Build Prompts

Use these **in order**. Prompt 0 starts the project. Prompts 1+ should be sent as follow-ups in the same Codex conversation/worktree unless there is a strong reason to start a fresh task.

Do not send all prompts at once. Each phase has a gate. The next prompt assumes the prior phase passed its tests.

---

## Prompt 0 — Research, challenge assumptions, and bootstrap the repository

```text
You are the lead staff engineer for this repository. Build a real production-shaped product named Fork. Before writing implementation code, read every handoff document in this repository: README.md, PRD.md, TECHNICAL_SPECIFICATION.md, SECURITY_AND_THREAT_MODEL.md, AGENTS.md, PLANS.md, TOOLS_MCP_SKILLS.md, ENVIRONMENT_AND_OPERATIONS.md, TESTING_AND_RELEASE.md, and SOURCES.md.

Treat those documents as product intent, but verify all volatile protocol facts from current primary sources and onchain state. Moonwell governance changed materially in 2026, so do not blindly assume any old governor topology. Research current official Moonwell docs, moonwell-contracts-v2, moonwell-sdk, Base docs, Foundry docs, Groq docs, viem/wagmi docs, NestJS/BullMQ docs as needed. Record the exact sources, relevant repository commit hashes, current governor/executor/Temporal Governor addresses, Base Comptroller/market registry addresses, and ABI provenance in docs/PROTOCOL_RESEARCH.md and docs/CONTRACT_REGISTRY.md. Verify configured contract addresses actually have bytecode on the expected chain.

Then bootstrap the pnpm/Turborepo monorepo structure described in TECHNICAL_SPECIFICATION.md with apps/web, apps/api, apps/indexer, apps/simulator and the shared packages. Use current stable compatible dependency versions; record why and exact versions in docs/DEPENDENCY_DECISIONS.md. Configure strict TypeScript, linting, formatting, test runners, shared tsconfig, Docker Compose for local MongoDB/Redis, basic health checks, .env.example, GitHub Actions skeleton, and docs/IMPLEMENTATION_STATUS.md.

Do NOT implement Moonwell business logic, governance decoding, Groq agent behavior, or simulations yet. The goal of this phase is verified research + a clean compilable skeleton.

No mocks/fake chain data. If official sources disagree on a security-critical/current Moonwell fact and onchain inspection does not resolve it, stop and ask me with the exact disagreement. Otherwise make the best verified decision and document it.

Before finishing: install dependencies, run lint/typecheck/tests/build for the skeleton, show me the resulting repo tree, summarize research findings, list all env vars introduced, tell me exactly what I must obtain/configure manually, and state whether Phase 1 is safe to begin.
```

---

## Prompt 1 — Blockchain/RPC foundation and verified contract registry

```text
Implement Phase 1 only: the blockchain/RPC foundation.

Create provider-agnostic viem clients for Base Mainnet and Ethereum Mainnet with typed primary/fallback RPC configuration, chain-ID validation, safe/finalized/historical block anchors, bigint-safe serialization, retry/error classification, and basic critical-read consistency checks. Implement contract-registry loading from verified configuration generated during Phase 0, including onchain bytecode checks and startup readiness failures for invalid chain/address combinations.

Create scripts/verify-contracts.ts and a real integration test that reads current Base and Ethereum state from the configured RPCs. Do not use mocked providers. Do not implement governance indexing or Moonwell position logic yet.

Add structured logging/correlation IDs where appropriate and update docs/ENVIRONMENT.md, docs/IMPLEMENTATION_STATUS.md, and any ADR required.

Run the real RPC tests. At the end explain what works, every env var required, rate-limit/fallback behavior, test output, and any current provider limitations. Stop after Phase 1.
```

---

## Prompt 2 — Moonwell Base read-only protocol adapter

```text
Implement the Moonwell Core read-only adapter on Base Mainnet only.

Using current official Moonwell SDK/docs/repositories plus direct viem calls where correctness/history requires it, implement:
- supported market discovery/registry;
- user position reads for an arbitrary Base address;
- collateral-membership detection;
- borrow/supply balances using correct current/historical contract semantics;
- canonical account liquidity/shortfall read from Moonwell Comptroller;
- normalized ProtocolPosition and RiskState domain objects;
- evidence references with block number/hash, contract address, method, and provider metadata.

Do not calculate canonical solvency in the LLM or frontend. Do not use JS floating point for token values. Gracefully handle no-position wallets and unsupported markets.

Add a CLI/script that accepts a Base address and prints its real Moonwell Core position/risk at a pinned block. Add real Base integration tests using known public addresses discovered from real Moonwell events; do not invent positions.

Update docs and test everything. Stop after this phase and tell me exact commands to reproduce the reads locally.
```

---

## Prompt 3 — Authoritative Moonwell governance indexer and normalized changes

```text
Implement the current authoritative Moonwell governance discovery/indexing path.

Re-verify current governance topology first. As of the handoff, Moonwell moved core governance to Ethereum via MultichainGovernorV2 and retains cross-chain destination execution on Base, but treat this as a fact to verify, not a constant. Document current contracts, events, execution windows/timelock semantics, Wormhole/destination flow, and Base Temporal Governor/executor roles.

Build apps/indexer + protocol-moonwell governance code to:
- backfill and incrementally poll the relevant Ethereum and Base contracts;
- persist raw logs/events with block hashes;
- track source proposal status separately from Base destination status;
- handle reorg/cursor rollback;
- normalize supported proposal actions into ProtocolChange/GovernanceCall objects;
- preserve raw calldata and decoded calls;
- classify unsupported/unknown selectors without guessing;
- derive affected Base Moonwell markets/assets for the first supported change class;
- store execution timing/status where contracts expose it.

Choose the first real historical/current risk-parameter change we will support end-to-end. Verify its exact proposal/action/transaction evidence and pin it in docs/PROTOCOL_RESEARCH.md. Do NOT fabricate a convenient governance event.

Write real-chain integration tests that ingest the selected historical event from chain data. Stop after the indexer reliably reconstructs the real change and all tests pass.
```

---

## Prompt 4 — Critical milestone: real Base fork impact simulation, no AI

```text
Implement the critical Fork simulation spine with NO AI yet.

Build apps/simulator and simulation-core. The worker must own Anvil process lifecycle, bind it privately, pin a real Base Mainnet block number+hash, wait for health checks, capture baseline Moonwell state, snapshot/revert branches safely, apply the selected real governance destination effect, and read Moonwell risk afterward.

Prefer FULL_REPLAY if the current Moonwell Base execution path can be faithfully reproduced. If reproducing Wormhole transport is not required/feasible, implement a clearly labeled DESTINATION_EFFECT_REPLAY using the exact real Base calls and the real authorized destination execution identity via Anvil-only impersonation/time control. Record every impersonation/time jump. Do not directly mutate EVM storage to create the desired result.

For historical acceptance, use a real historical wallet position if one can be identified from chain data. Search/index real Moonwell users at the pre-event block and find a wallet for which the real change produces a measurable risk delta. Do not synthesize a vulnerable wallet. If the event does not push a real wallet into shortfall, prove the real material safety reduction rather than inventing liquidation.

Create a CLI command such as `pnpm fork:replay <scenario>` that performs the real simulation end-to-end and emits a preliminary proof receipt.

This is the most important milestone. Do not proceed until it is reproducible from a clean checkout with a real archive RPC. Run it multiple times and compare outputs. Document exact runtime prerequisites and resource usage. Stop after the deterministic before/after simulation works.
```

---

## Prompt 5 — Exposure matcher, risk policy, and durable proof receipts

```text
Implement deterministic exposure matching, user risk policy evaluation, simulation persistence, and versioned proof receipts.

Requirements:
- deterministic wallet-position-to-change matching;
- risk-policy object and versioning;
- material-risk classification from canonical Moonwell state;
- canonical receipt schema with block hashes, raw governance calls, replay grade, before/after contract reads, simulation tx evidence, code/address provenance, engine version;
- canonical serialization + receipt hash;
- Mongo schemas/indexes for protocol changes, exposures, simulation runs, evidence, and receipts;
- a `scripts/reproduce-receipt.ts` path that can verify/re-run a stored historical receipt.

No AI. No UI. No fake receipt fields. Every evidence field must be sourced from real execution or explicitly nullable/unsupported.

Add tests and update docs. Stop after proof reproduction passes.
```

---

## Prompt 6 — Deterministic rescue strategy engine

```text
Implement the two V1 rescue strategies without AI:

1. REPAY_DEBT
2. ADD_COLLATERAL

Use the real Moonwell mToken/Comptroller mechanics verified from current official docs/contracts. Build typed transaction-plan generators, ERC20 approval handling with bounded/exact approvals, feasibility checks, pause/cap/collateral-membership checks, and integer-safe amount logic.

Do not let a guessed amount stand. Implement deterministic search (binary/monotonic search where mathematically valid and empirically verified) to find the minimum amount that satisfies the configured risk policy. Every tested amount must be executed on a reset Anvil branch, followed by the governance change and canonical post-state verification.

A candidate is VERIFIED only if all transactions succeed and post-state policy passes. Persist rejected/verified branch evidence.

Use real wallet balances at the anchor. If a real historical wallet lacks a rescue asset, report the strategy as infeasible rather than minting fake assets.

Add real-chain acceptance tests and CLI output comparing strategies. Stop after both strategies work where feasible and invalid amounts are demonstrably rejected.
```

---

## Prompt 7 — Groq agent orchestrator with bounded local tool calling

```text
Implement Fork's AI agent orchestration now that deterministic tools exist.

Use Groq local function calling. Primary model: env-configured `openai/gpt-oss-120b`; fallback/light model: `openai/gpt-oss-20b`. Do not use deprecated llama-3.1-8b-instant. Build a ModelProvider abstraction so model/provider changes are configuration, not domain rewrites.

The agent may choose what to investigate and which supported strategy class(es) to try, but it must not calculate solvency or create arbitrary transactions. Expose narrow semantic tools backed by the deterministic services already implemented. Validate every tool argument with Zod, enforce max steps/time/token budgets, reject repeated invalid calls, and keep tool-policy authorization in code.

Treat governance text/token metadata as untrusted data. Do not expose arbitrary web, shell, database, RPC, or transaction tools. In production requests, do not expose/store raw model chain-of-thought; create user-safe decision summaries and structured agent trace events instead.

Implement Groq rate-limit handling and fallback. Never fallback to fabricated financial conclusions if both models fail.

Add live Groq acceptance tests gated by required env credentials, not mocked model responses. Update env/docs and stop after the agent can select tools/strategies over the real simulation pipeline.
```

---

## Prompt 8 — Persistence, BullMQ orchestration, SSE, and API

```text
Implement the production orchestration layer in NestJS.

Add MongoDB persistence/index migrations, Redis/BullMQ queues, idempotent job keys, retry classifications, backoff, concurrency limits, graceful shutdown, and dead/failed-job inspection. Wire the API to queue real impact simulations rather than blocking HTTP.

Implement the `/api/v1` endpoints from the technical spec, including wallet reads, relevant changes, simulation creation/status, strategy/proof endpoints, historical replay, agent trace, health/readiness, and SSE progress streaming. SSE must be reconnect-safe: persisted state is source of truth and clients can rehydrate.

Enforce rate limits for public simulation endpoints and validate all DTOs. Do not expose internal Anvil RPC or unrestricted queue controls.

Run local Mongo/Redis containers plus real Base/Ethereum/Groq/Anvil integrations for acceptance. Stop after API-level E2E can launch a real simulation and stream completion.
```

---

## Prompt 9 — Next.js product UI and wallet UX

```text
Build the Fork web application using Next.js App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand only where useful, wagmi, and viem.

Required flows:
- paste any Base address for read-only analysis;
- connect wallet separately;
- display real supported Moonwell positions/current risk;
- display relevant governance changes with confidence/source vs destination status;
- launch simulation;
- show live SSE progress;
- show before/after state clearly;
- show agent trace summaries/tool evidence;
- show verified/rejected strategies;
- proof/evidence detail page;
- explicit unsupported/error/stale/cancelled states;
- historical replay entry only for real pinned scenarios.

Do not hard-code fake dashboard numbers. All primary product data comes from backend responses. No unsupported protocol logos.

Add responsive/accessibility basics and Playwright tests. Stop after the real end-to-end flow works from UI to Anvil and back.
```

---

## Prompt 10 — Wallet authentication and real user-signed Base execution

```text
Implement connected-wallet ownership/authentication and supported mainnet execution preparation.

Use signed nonce/message authentication with expiry/replay protection for mutating wallet preferences. Read-only analysis remains public.

For execution:
- revalidate governance status and wallet state;
- require a fresh simulation/proof;
- adapter generates only allowlisted transaction plan(s) for REPAY_DEBT or ADD_COLLATERAL;
- frontend shows exact target, method, amount, approval/spender, and expected state;
- ensure wallet is on Base Mainnet 8453;
- user explicitly signs/sends with wagmi/viem;
- backend never receives private key;
- register tx hash, wait/observe receipt, then re-read real Moonwell post-state;
- mark VERIFIED/PARTIAL/MISMATCH based on actual state, not receipt alone.

Do not enable autonomous delegated execution. Do not expose arbitrary calldata endpoint.

Use a controlled real mainnet transaction only if I explicitly provide/fund a wallet and approve spending. Otherwise fully test transaction construction/signing on safe test assets/environments and keep mainnet send user-controlled. Do not fake a mainnet tx.

Stop after transaction preparation and post-state verification paths are complete.
```

---

## Prompt 11 — Continuous monitoring and relevance-driven processing

```text
Turn the governance/indexing path into a resilient continuous production monitor.

Requirements:
- resumable cursors on Ethereum/Base;
- reorg detection/rollback;
- scheduled polling;
- refresh normalized change status;
- detect cancellation/expiry/execution;
- enqueue exposure refresh/simulation only for affected monitored wallets;
- deduplicate jobs;
- cancel/mark stale simulations when source truth changes;
- metrics for index lag and queue age;
- clear user-visible lifecycle transitions.

Do not add email/Telegram notifications unless core monitoring is already stable. Focus on correctness and processing scalability.

Load-test the indexer/queue with real chain reads while respecting provider quotas. Stop after monitoring survives restart and duplicate/reorg test cases.
```

---

## Prompt 12 — Harden the real historical replay used for judging/reproducibility

```text
Harden one real historical replay as a reproducible public verification path.

It must use:
- a real governance action;
- real source/destination chain evidence;
- a real Base block/hash before execution;
- real Moonwell contracts;
- a real historical wallet position if feasible;
- no synthetic vulnerable position;
- recomputation on every run, not saved fake results.

If the real wallet did not become insolvent, show the actual measured degradation honestly. If another real event/wallet produces a clearer effect, research and switch only with documented evidence.

Add a deterministic replay manifest containing identifiers/anchors, not result values. The result must be recomputed. Add CI/manual reproduction command and proof receipt comparison.

Stop after a fresh checkout can reproduce the replay from env + archive RPC.
```

---

## Prompt 13 — Security, resilience, performance, and edge-case audit

```text
Perform a staff-level hardening pass against PRD edge cases and SECURITY_AND_THREAT_MODEL.md.

Audit:
- prompt injection and tool abuse;
- arbitrary transaction/call escape paths;
- governance decoder ambiguity;
- proxy/ABI/code-hash drift;
- RPC inconsistency and archive failures;
- reorgs;
- stale simulations;
- Anvil zombie processes/port collisions/timeouts;
- BullMQ retries/idempotency/backpressure;
- Mongo indexes and growth;
- bigint serialization;
- wallet/network switching;
- token approval safety;
- Groq rate limits/model deprecation;
- SSE reconnection;
- mainnet post-state mismatches.

Run load/performance tests with realistic concurrency for our available machine. Fix issues found, not just document them. Add metrics/health checks and explicit known limitations for anything outside V1.

Use Codex review/security capabilities if available. Stop after all high/critical issues are resolved or explicitly blocked by an external limitation I must decide on.
```

---

## Prompt 14 — Full E2E/release gate

```text
Run the complete Fork release gate from a clean environment.

Validate:
1. install from lockfile;
2. env validation;
3. Mongo/Redis startup;
4. Base/Ethereum RPC readiness;
5. current contract-registry bytecode checks;
6. real Moonwell position read;
7. governance index/backfill;
8. real historical fork replay;
9. before/after risk proof;
10. deterministic rescue optimization;
11. live Groq bounded-tool agent flow;
12. REST/SSE flow;
13. Next.js browser flow in Playwright;
14. transaction-plan allowlist validation;
15. proof receipt reproduction;
16. graceful process shutdown/no orphan Anvil.

No mocks. If a test fails because of a free-tier external provider limit, implement robust retry/skip classification for development but do not mark release green until the real acceptance flow is successfully executed once and evidence is recorded.

Produce a release report with timings, resource usage, exact commit, exact external contract registry version, and known limitations. Stop after the release gate is green.
```

---

## Prompt 15 — Final documentation, deployment, and handoff

```text
Prepare Fork for another engineer and for deployment.

Finish README.md and docs so a person with zero prior context can:
- understand the product and architecture;
- install Node/pnpm/Docker/Foundry prerequisites;
- obtain every required API/RPC key;
- create .env from .env.example;
- run Mongo/Redis;
- run API/indexer/simulator/web;
- run the real historical replay CLI;
- run all test tiers;
- verify Groq models and rate limits;
- deploy the web/API/indexer/simulator safely;
- understand how mainnet user signing works;
- understand exactly what is and is not supported.

Give me a final concise but complete explanation of everything you built. Then give me:
1. every environment variable grouped by app with where to obtain it;
2. exact local setup commands;
3. exact production deployment order;
4. exact real end-to-end test procedure;
5. how to reproduce the historical replay;
6. how to test a live Base wallet;
7. how to verify proof receipts;
8. known limitations/risks;
9. what should be built next and what should NOT be touched before the hackathon submission.

Check for stale TODOs, fake placeholders, mock adapters, dead code, unsupported logos, secrets, and docs/code divergence. Run final lint/typecheck/tests/build/release gate and report results.
```
