# Fork — Technical Specification

**Version:** 1.0  
**Prepared:** 2026-08-15  
**Architecture style:** TypeScript monorepo, event-driven simulation workers, evidence-first agent orchestration

---

## 1. Architecture goals

Fork must be production-shaped from the beginning without adding infrastructure for its own sake. The design optimizes for:

- deterministic onchain truth;
- independently scalable simulation work;
- narrow and auditable LLM authority;
- reproducibility;
- no custody of user secrets;
- real Base/Moonwell integrations;
- clean protocol-adapter boundaries;
- graceful handling of governance upgrades;
- low cost for hackathon traffic.

The system is **offchain software operating on real onchain state**. Fork itself does not need a smart contract in V1.

---

## 2. Locked stack

### Application

- Package manager: `pnpm`
- Monorepo: Turborepo or pnpm workspaces; Turborepo preferred for task orchestration.
- Language: TypeScript with `strict` enabled.
- Frontend: Next.js App Router + React + Tailwind CSS + shadcn/ui.
- Frontend data: TanStack Query.
- Lightweight client state: Zustand.
- Wallet: wagmi + viem.
- Backend: NestJS.
- Database: MongoDB via `@nestjs/mongoose`/Mongoose unless a strong implementation reason requires the native driver.
- Queue/cache: Redis + BullMQ (`@nestjs/bullmq`).
- Blockchain client: viem for new code.
- Simulation: Foundry/Anvil.
- AI: Groq SDK / OpenAI-compatible Groq API.
- Primary planner: `openai/gpt-oss-120b`.
- Secondary/fallback: `openai/gpt-oss-20b`.
- Validation: Zod for tool/external payloads; Nest DTO validation for HTTP boundaries.
- E2E browser tests: Playwright Test.
- Unit/integration: Vitest or Jest; use one consistently per app/package.
- Logging: structured JSON via Pino/Nest integration.

### Network

- Protected user positions: Base Mainnet (`8453`).
- Current primary Moonwell governance source: Ethereum Mainnet, verified from current contracts because Moonwell migrated governance in 2026.
- Base destination execution: Moonwell Base governance/executor/Temporal Governor path, verified at runtime/research phase.
- Base Sepolia: development of generic wallet-signing UI only if useful; not source of product truth.

### Versioning rule

Codex must determine current stable compatible versions at bootstrap, record exact versions in `docs/DEPENDENCY_DECISIONS.md`, and commit the lockfile. Do not silently float major versions.

---

## 3. Proposed repository layout

```text
fork/
├── apps/
│   ├── web/                       # Next.js
│   ├── api/                       # NestJS HTTP/SSE, orchestration
│   ├── indexer/                   # Governance/indexing worker
│   └── simulator/                 # BullMQ worker that owns Anvil processes
├── packages/
│   ├── shared/                    # domain types, errors, schemas
│   ├── config/                    # typed env/config loaders
│   ├── blockchain/                # viem clients, RPC policy, block anchors
│   ├── protocol-core/             # generic ProtocolAdapter contracts
│   ├── protocol-moonwell/         # Moonwell Base + governance implementation
│   ├── governance-core/           # normalized protocol-change domain
│   ├── simulation-core/           # fork lifecycle + receipts
│   ├── risk-engine/               # deterministic policy/invariants
│   ├── strategy-engine/           # strategy types + optimizers
│   ├── agent-core/                # Groq loop, tools, tool policy
│   ├── abis/                      # pinned ABI artifacts + provenance
│   └── observability/             # logging/metrics helpers
├── tests/
│   ├── chain/                     # real archive/fork acceptance tests
│   ├── e2e/                       # API/UI real-flow tests
│   └── fixtures/                  # pure deterministic test vectors only
├── scripts/
│   ├── research-moonwell.ts
│   ├── backfill-governance.ts
│   ├── verify-contracts.ts
│   └── reproduce-receipt.ts
├── docs/
│   ├── IMPLEMENTATION_STATUS.md
│   ├── PROTOCOL_RESEARCH.md
│   ├── DEPENDENCY_DECISIONS.md
│   ├── CONTRACT_REGISTRY.md
│   ├── RUNBOOK.md
│   └── ADR/
├── AGENTS.md
├── PLANS.md
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

Do not merge indexer/simulator into the HTTP process merely to reduce files. They are different failure/scaling domains.

---

## 4. Runtime topology

```text
Browser / Wallet
      |
      v
Next.js Web
      |
   HTTPS/SSE
      |
      v
NestJS API ------------------> MongoDB
      |                            |
      |                            +-- durable domain/audit data
      |
      +-----------------------> Redis/BullMQ
                                   |
                 +-----------------+------------------+
                 |                                    |
                 v                                    v
         Governance Indexer                     Simulator Workers
                 |                                    |
         Ethereum/Base RPC                    spawn private Anvil
                 |                                    |
                 +-------------------------> Base archive RPC
                                                      |
                                                real Moonwell state

NestJS API --> Groq (bounded tool-calling orchestration)
```

The simulator must not be serverless. It needs process spawning, Foundry binaries, memory/CPU, and deterministic cleanup.

---

## 5. Domain model

### 5.1 `BlockAnchor`

```ts
interface BlockAnchor {
  chainId: number;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  timestamp: number;
  finality: 'latest' | 'safe' | 'finalized' | 'historical';
  rpcProviderId: string;
}
```

Critical simulations store number **and hash**. Do not identify historical state by block number only.

### 5.2 `ProtocolPosition`

```ts
interface ProtocolPosition {
  protocol: 'moonwell';
  chainId: 8453;
  wallet: `0x${string}`;
  market: `0x${string}`;
  underlying: `0x${string}`;
  suppliedRaw: bigint;
  borrowedRaw: bigint;
  collateralEnabled: boolean;
  exchangeRateRaw?: bigint;
  metadata: Record<string, unknown>;
  anchor: BlockAnchor;
}
```

### 5.3 `RiskState`

```ts
interface RiskState {
  wallet: `0x${string}`;
  protocol: 'moonwell';
  anchor: BlockAnchor;
  liquidityRaw: bigint;
  shortfallRaw: bigint;
  status: 'SAFE' | 'AT_RISK' | 'SHORTFALL' | 'UNKNOWN';
  derived?: {
    safetyBufferBps?: number;
    usd?: Record<string, string>;
  };
  evidence: EvidenceRef[];
}
```

Canonical safety comes from protocol contracts. Derived UI metrics must never replace canonical state.

### 5.4 `ProtocolChange`

```ts
type ProtocolChangeStatus =
  | 'ADVISORY'
  | 'PROPOSED'
  | 'APPROVED'
  | 'DESTINATION_PENDING'
  | 'QUEUED'
  | 'EXECUTABLE'
  | 'EXECUTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'UNKNOWN';

type ProtocolChangeType =
  | 'COLLATERAL_FACTOR_CHANGE'
  | 'BORROW_CAP_CHANGE'
  | 'SUPPLY_CAP_CHANGE'
  | 'INTEREST_RATE_MODEL_CHANGE'
  | 'MARKET_CONFIGURATION_CHANGE'
  | 'CONTRACT_UPGRADE'
  | 'UNKNOWN';

interface ProtocolChange {
  id: string;
  protocol: 'moonwell';
  sourceChainId: number;
  destinationChainId: 8453;
  status: ProtocolChangeStatus;
  type: ProtocolChangeType;
  proposalId?: string;
  sourceTxHashes: `0x${string}`[];
  destinationTxHashes?: `0x${string}`[];
  targetCalls: GovernanceCall[];
  affectedMarkets: `0x${string}`[];
  affectedAssets: `0x${string}`[];
  earliestExecutionAt?: Date;
  latestExecutionAt?: Date;
  discoveredAt: Date;
  updatedAt: Date;
  evidence: EvidenceRef[];
  supportLevel: 'FULL_REPLAY' | 'DESTINATION_EFFECT_REPLAY' | 'ANALYSIS_ONLY' | 'UNSUPPORTED';
}
```

### 5.5 `GovernanceCall`

Store both raw and decoded forms:

```ts
interface GovernanceCall {
  destinationChainId: number;
  target: `0x${string}`;
  valueRaw: bigint;
  calldata: `0x${string}`;
  selector: `0x${string}`;
  decoded?: {
    functionName: string;
    args: unknown[];
    abiSource: string;
  };
}
```

No decoded value may overwrite/discard raw calldata.

### 5.6 `UserRiskPolicy`

```ts
interface UserRiskPolicy {
  minSafetyBufferBps: number;
  optimizationGoal: 'MIN_CAPITAL' | 'MAX_SAFETY' | 'MIN_TX_COUNT';
  allowRepayDebt: boolean;
  allowAddCollateral: boolean;
  maxRepayRawByAsset?: Record<string, string>;
  maxCollateralRawByAsset?: Record<string, string>;
}
```

Policy is deterministic and cannot be overridden by the LLM.

---

## 6. Moonwell adapter

### 6.1 Generic adapter interface

```ts
interface ProtocolAdapter {
  readonly protocolId: string;

  getUserPositions(wallet: Address, anchor?: BlockAnchor): Promise<ProtocolPosition[]>;
  getRiskState(wallet: Address, client: PublicClient, anchor: BlockAnchor): Promise<RiskState>;
  listRelevantChanges(range: BlockRange): Promise<ProtocolChange[]>;
  refreshChange(changeId: string): Promise<ProtocolChange>;
  matchExposure(positions: ProtocolPosition[], change: ProtocolChange): Promise<ExposureResult>;
  replayChange(ctx: ForkContext, change: ProtocolChange): Promise<ReplayResult>;
  buildRepayPlan(input: RepayPlanInput): Promise<TransactionPlan>;
  buildAddCollateralPlan(input: AddCollateralPlanInput): Promise<TransactionPlan>;
  verifyPostState(input: VerificationInput): Promise<VerificationResult>;
}
```

### 6.2 Read path

Use Moonwell SDK where it reduces maintenance for current market/user metadata, but use direct pinned ABI/viem calls for security-critical and historical functions where version drift matters.

Read/verify at minimum:

- official Base Comptroller address;
- active mToken/market addresses;
- underlying token metadata;
- user balances/borrow balances/collateral membership;
- account liquidity/shortfall via Comptroller;
- current risk parameters relevant to supported changes.

All addresses must have source provenance and should be verified against onchain bytecode.

### 6.3 Governance path

As of this handoff, Moonwell governance migrated its primary governor to Ethereum via MIP-X58, while Base remains a governed destination using cross-chain infrastructure/Temporal Governor. The implementation must **not** simply copy an old Moonbeam-centric diagram.

During Phase 0/4 Codex must:

1. inspect current Moonwell official docs and `moonwell-contracts-v2`;
2. identify current MultichainGovernorV2 proxy/implementation on Ethereum;
3. identify Base Temporal Governor and any destination executor/receiver/bridge adapters;
4. identify events/functions needed to follow proposal → approved → destination message → queued/executable → execution;
5. verify addresses with onchain code;
6. pin source URLs, commit hashes, addresses, ABI hashes in `docs/CONTRACT_REGISTRY.md`;
7. create automated startup/CI checks that fail if configured addresses have no code or unexpected chain IDs.

Do not ask the LLM to infer governance state from proposal text when contracts expose it.

### 6.4 Replay semantics

Two replay grades are allowed:

#### `FULL_REPLAY`

The simulator faithfully executes the supported governance/destination path in fork(s), including timelock semantics where practical.

#### `DESTINATION_EFFECT_REPLAY`

The exact destination call(s) are known, but reproducing Wormhole transport is unnecessary or not yet supported. Fork executes the exact Base target calls from the authorized Base governance execution context using Anvil impersonation/time manipulation.

This grade proves the **Base economic/state effect**, not cross-chain message delivery reliability. The UI/receipt must say this.

If neither is possible, mark `ANALYSIS_ONLY`/`UNSUPPORTED`; do not synthesize a result.

---

## 7. Governance indexer

### 7.1 Why separate service

Governance synchronization is periodic, resumable, IO-bound, and independent of user HTTP traffic.

### 7.2 State

Persist per source:

```ts
interface IndexCursor {
  sourceId: string;
  chainId: number;
  lastProcessedBlock: bigint;
  lastProcessedBlockHash: Hex;
  updatedAt: Date;
}
```

### 7.3 Polling

Default interval: 30–60 seconds. Governance does not require sub-second latency.

Workflow:

1. load last safe cursor;
2. read chain head/safe block;
3. fetch logs in bounded ranges;
4. decode supported events;
5. upsert raw event by chain/log identity;
6. build/refresh normalized changes;
7. advance cursor only after successful persistence;
8. detect reorg by comparing stored cursor block hash;
9. roll back affected normalized data if necessary.

### 7.4 RPC provider abstraction

Define provider roles:

- Base primary archive RPC;
- Base fallback RPC;
- Ethereum primary archive RPC;
- Ethereum fallback RPC.

Critical historical anchors should optionally be verified across two providers or at least verify block hash and code state before simulation.

Provider-specific URLs are configuration, never hard-coded business logic.

---

## 8. Exposure engine

Exposure matching should be deterministic for V1.

Examples:

- change targets collateral factor for wrsETH market;
- wallet has wrsETH mToken supplied and market entered as collateral;
- result: direct exposure.

Return:

```ts
interface ExposureResult {
  relevant: boolean;
  severityHint: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  matchedMarkets: Address[];
  matchedAssets: Address[];
  rationaleCodes: string[];
  evidence: EvidenceRef[];
}
```

The LLM can explain this result but must not be required to produce it.

---

## 9. Simulation service

### 9.1 Worker isolation

`apps/simulator` consumes BullMQ jobs and is the only service allowed to spawn/own Anvil processes.

Never expose Anvil on public interfaces. Bind to `127.0.0.1`/private container network.

### 9.2 Fork lifecycle

1. reserve a port/process slot;
2. spawn `anvil --fork-url <BASE_RPC> --fork-block-number <N>`;
3. wait for `eth_chainId`, block hash, and basic contract-read health checks;
4. create viem clients pointed at Anvil;
5. verify pinned block metadata;
6. capture baseline position/risk;
7. snapshot (`evm_snapshot`/Anvil equivalent);
8. replay change;
9. capture after-change state;
10. revert baseline for strategy branches;
11. execute candidate branch;
12. replay future change in correct order;
13. verify post-state;
14. persist evidence;
15. stop child process in `finally`;
16. watchdog kills orphaned process after timeout.

### 9.3 Snapshot strategy

Within one simulation job, reuse a single fork with baseline snapshots to reduce archive RPC load. Never let state leak between strategy branches.

### 9.4 Time-sensitive governance

Anvil may advance timestamp/block number or impersonate accounts **inside the fork** to satisfy timelock/execution requirements. Every such action must be recorded in the receipt. Never mutate storage directly merely to “make the result happen” unless there is no faithful call path; direct storage mutation is prohibited in accepted V1 simulations.

### 9.5 Simulation timeout and cancellation

- hard timeout per simulation job;
- cooperative cancellation when source change is cancelled/stale;
- child-process termination on worker shutdown;
- queue job remains retriable only for transient errors, not deterministic unsupported/revert cases.

---

## 10. Risk engine

Risk engine is deterministic.

Responsibilities:

- classify canonical Moonwell shortfall/liquidity state;
- evaluate user risk policy;
- compare before/after;
- compute derived safety metrics with explicit formulas and integer/decimal libraries;
- reject invalid plans;
- rank verified plans from structured metrics.

Never use JavaScript `number` for token accounting. Use `bigint`, decimal strings, or a decimal library only at presentation boundaries.

---

## 11. Strategy engine

### 11.1 V1 strategy types

```ts
type StrategyType = 'REPAY_DEBT' | 'ADD_COLLATERAL';
```

No arbitrary strategy plugin is available to the model in V1.

### 11.2 Repay debt

Inputs:

- debt market/token;
- current debt;
- wallet token balance at anchor/current state;
- user max spend;
- Moonwell repay mechanics;
- approval requirement;
- target safety policy.

Optimization:

Use monotonic/binary search over integer amounts where risk response is monotonic and validated. Bound search by `min(wallet balance, debt, user policy max)`.

Every candidate amount is actually executed on a reset fork branch and verified.

### 11.3 Add collateral

Inputs:

- eligible supported collateral already held by wallet;
- market entry/collateral enablement state;
- token balance;
- supply/approval mechanics;
- user max collateral amount;
- caps/pauses.

Optimize minimum amount that passes user policy through fork execution.

### 11.4 Transaction plan

```ts
interface TransactionPlan {
  chainId: 8453;
  strategyType: StrategyType;
  calls: Array<{
    to: Address;
    value: bigint;
    data: Hex;
    description: string;
    allowlistRuleId: string;
  }>;
  expectedState: VerificationExpectation;
}
```

The model never constructs arbitrary calls. The adapter constructs them from typed inputs.

---

## 12. Mainnet execution safety

### 12.1 No backend signer

The server does not store user keys and does not submit user transactions with a custodial key.

### 12.2 Freshness gate

Before returning a signable plan:

1. refresh governance change;
2. refresh wallet position/balances;
3. verify chain head and relevant contract code;
4. determine whether prior proof is stale;
5. if stale, run fresh simulation;
6. simulate exact plan against fresh state;
7. return plan plus expiration/staleness metadata.

### 12.3 Frontend signing

Use wagmi/viem. Validate wallet chain is Base Mainnet. Show calls before signing. Handle user rejection and wallet switching.

### 12.4 Post-transaction verification

After receipt:

- confirm `status=success`;
- re-read Moonwell risk and relevant balances;
- compare actual state to expected state;
- mark execution `VERIFIED`, `PARTIAL`, or `MISMATCH`;
- never mark success solely from tx receipt if post-state invariant fails.

---

## 13. AI agent architecture

### 13.1 Why a custom loop

Fork's agent should be small enough to audit. Groq supports local function/tool calling, which allows NestJS to retain control of tool execution. Avoid adding LangChain/CrewAI unless a later requirement proves necessary.

### 13.2 Models

Primary:

```text
openai/gpt-oss-120b
```

Fallback/lighter:

```text
openai/gpt-oss-20b
```

At handoff time Groq's Free Plan docs list both at 30 RPM, 1K requests/day, 8K TPM, and 200K tokens/day; provider limits are volatile and must be treated as configuration/operational constraints, not contractual product guarantees.

Do not use `llama-3.1-8b-instant`; Groq announced shutdown for Free/Developer usage on 2026-08-16.

### 13.3 Tool policy

Allowlisted tools should be semantic and narrow, e.g.:

- `get_wallet_positions`
- `get_change_details`
- `get_exposure`
- `run_impact_simulation`
- `list_available_rescue_assets`
- `optimize_repayment`
- `optimize_add_collateral`
- `get_verified_strategies`
- `compare_verified_strategies`

Do not expose:

- shell execution;
- arbitrary RPC method access;
- arbitrary transaction construction;
- arbitrary Mongo query;
- unrestricted HTTP fetch;
- mainnet signing.

### 13.4 Loop

```text
context facts
    -> Groq
    -> zero or more tool-call requests
    -> validate JSON schema
    -> tool-policy authorization
    -> execute local tool
    -> persist trace event
    -> return structured result
    -> repeat up to MAX_AGENT_STEPS
    -> final explanation/selection
```

Recommended defaults:

- `AGENT_MAX_STEPS=10` or 12;
- planner reasoning effort `medium`, elevate to `high` only for hard unsupported-change interpretation;
- `include_reasoning=false` in production;
- low temperature;
- hard token budgets;
- circuit-break repeated invalid calls.

### 13.5 Prompt-injection handling

Proposal descriptions, token metadata, forum content, revert strings, and external text are untrusted data. Wrap/label them as data. Never concatenate them into the instruction section without delimiters. The system prompt states that tool policy and deterministic state override all text found in protocol metadata.

### 13.6 Trace

Persist only user-safe summaries generated by application logic/model final explanations. Do not store or display provider hidden reasoning as product trace.

---

## 14. MongoDB design

Suggested collections:

### `wallets`

- normalized address;
- owner/auth metadata if connected;
- monitoring enabled;
- created/updated.

Indexes:

- unique `{ chainId, address }`.

### `walletRiskPolicies`

- walletId;
- policy fields;
- version;
- unique active policy per wallet/version rules.

### `positionSnapshots`

- wallet;
- block number/hash;
- positions;
- risk state;
- capturedAt.

Indexes:

- `{ wallet: 1, 'anchor.blockNumber': -1 }`;
- TTL only if raw high-frequency snapshots are intentionally ephemeral. Keep evidence-referenced snapshots durable.

### `governanceRawEvents`

- chain/log identity;
- raw event;
- block hash;
- decoded event.

Unique index:

- `{ chainId:1, txHash:1, logIndex:1 }`.

### `protocolChanges`

Indexes:

- `{ protocol:1, status:1, earliestExecutionAt:1 }`;
- `{ affectedMarkets:1, status:1 }`;
- `{ affectedAssets:1, status:1 }`;
- unique canonical change ID.

### `exposures`

Indexes:

- unique `{ wallet:1, protocolChangeId:1 }`;
- `{ relevant:1, severityHint:1 }`.

### `simulationRuns`

- wallet/change/mode;
- anchor;
- before/after;
- replay grade;
- status;
- timing;
- error classification;
- receipt hash.

Indexes:

- `{ wallet:1, protocolChangeId:1, createdAt:-1 }`;
- `{ status:1, createdAt:1 }`;
- idempotency key unique.

### `simulationBranches`

- runId;
- strategy;
- parameters;
- tx evidence;
- post-state;
- verification.

### `agentRuns` / `agentTraceEvents`

Index by run/sequence. Trace events may use a TTL for verbose operational detail only if the proof/audit subset remains durable.

### `executionAttempts`

- wallet;
- plan hash;
- tx hashes;
- expected state;
- actual state;
- status.

Mongo migrations/index creation should be explicit startup/deployment tasks rather than silently relying on automatic index sync in production.

---

## 15. Redis/BullMQ

Queues:

- `governance-sync`
- `wallet-refresh`
- `impact-simulation`
- `strategy-simulation` (may be child flow or internal simulator orchestration)
- `agent-analysis`
- `post-execution-verify`
- `maintenance`

Job requirements:

- stable job IDs/idempotency keys;
- retry only transient classifications;
- exponential backoff with jitter;
- dead-letter/failed-job inspection;
- bounded concurrency per worker;
- worker shutdown hooks;
- producer fail-fast if Redis is unavailable;
- worker reconnect behavior appropriate for BullMQ production guidance.

For hackathon hardware begin with `MAX_PARALLEL_FORKS=2` or 3 and measure memory/RPC load.

---

## 16. API surface

Prefix with `/api/v1`.

### Public/read-only

```text
GET  /health
GET  /protocols
GET  /wallets/:address/positions
GET  /wallets/:address/risk
GET  /wallets/:address/relevant-changes
GET  /changes
GET  /changes/:id
POST /simulations/impact
GET  /simulations/:id
GET  /simulations/:id/stream       # SSE
GET  /simulations/:id/proof
GET  /simulations/:id/strategies
GET  /agent-runs/:id/trace
GET  /historical-replays
POST /historical-replays/:slug/run
```

### Connected/authenticated

```text
POST /auth/nonce
POST /auth/verify-signature
PUT  /wallets/:address/policy
POST /execution/prepare
POST /execution/:planId/register-tx
GET  /execution/:planId
```

No endpoint accepts arbitrary model-generated mainnet calldata.

---

## 17. Authentication

Read-only public-chain analysis can be anonymous with rate limits.

For persisted wallet preferences/execution association:

- issue short-lived nonce;
- user signs a clear wallet-auth message;
- server verifies address/signature/nonce/domain/expiry;
- create short-lived secure session/JWT;
- bind authorization to wallet address.

Do not conflate “can inspect public wallet” with “owns wallet.”

---

## 18. SSE event model

Example event types:

```text
SIMULATION_QUEUED
FORK_STARTING
FORK_READY
BASELINE_CAPTURED
CHANGE_REPLAY_STARTED
CHANGE_REPLAY_COMPLETED
RISK_MEASURED
AGENT_STARTED
STRATEGY_OPTIMIZATION_STARTED
STRATEGY_BRANCH_RESULT
RECOMMENDATION_READY
PROOF_READY
FAILED
CANCELLED
```

Persist durable state first, then emit event. The UI must be able to reconnect and hydrate current status from REST if an SSE message is missed.

---

## 19. Evidence and simulation receipt

### 19.1 Evidence reference

```ts
interface EvidenceRef {
  type:
    | 'BLOCK'
    | 'LOG'
    | 'TRANSACTION'
    | 'CONTRACT_CALL'
    | 'CONTRACT_CODE'
    | 'SIMULATED_TRANSACTION'
    | 'TOOL_RESULT';
  chainId: number;
  blockNumber?: string;
  blockHash?: Hex;
  txHash?: Hex;
  address?: Address;
  method?: string;
  rawHash?: Hex;
}
```

### 19.2 Receipt canonicalization

- deterministic field ordering/canonical JSON representation;
- raw bigint encoded as decimal strings;
- hash with `keccak256` or another explicitly versioned hash procedure;
- include `receiptSchemaVersion` and `engineVersion`.

Provide `scripts/reproduce-receipt.ts <receipt-id-or-file>` that recreates/checks the simulation where upstream archive data remains accessible.

---

## 20. Idempotency and staleness

Impact simulation idempotency key should include at least:

```text
wallet + change revision/hash + Base anchor block hash + risk policy version + engine version
```

Strategy branch key adds strategy type/parameters.

Staleness rules:

- live simulations expire after configurable blocks/time or any material wallet/change update;
- transaction preparation always performs a freshness check;
- historical receipts never “refresh”; they are immutable and anchored.

---

## 21. Error taxonomy

Do not return generic 500s for domain failures. Define typed errors:

- `UNSUPPORTED_PROTOCOL_CHANGE`
- `UNSUPPORTED_MARKET`
- `GOVERNANCE_STATE_UNCERTAIN`
- `CROSS_CHAIN_PAYLOAD_UNRESOLVED`
- `RPC_ARCHIVE_UNAVAILABLE`
- `RPC_INCONSISTENT_STATE`
- `FORK_START_FAILED`
- `FORK_TIMEOUT`
- `CHANGE_REPLAY_REVERTED`
- `RISK_READ_FAILED`
- `NO_RELEVANT_EXPOSURE`
- `NO_FEASIBLE_STRATEGY`
- `STRATEGY_POLICY_REJECTED`
- `GROQ_RATE_LIMITED`
- `GROQ_INVALID_TOOL_CALL`
- `SIMULATION_STALE`
- `CHANGE_CANCELLED`
- `MAINNET_STATE_MISMATCH`
- `USER_REJECTED_SIGNATURE`

Errors must include whether retry is safe.

---

## 22. Observability

Every request/job has:

- `requestId`;
- `jobId`;
- `simulationId`;
- `agentRunId` when relevant.

Metrics:

- RPC calls/errors/latency by chain/provider/method;
- governance blocks indexed and lag;
- queue depth/age;
- fork spawn duration;
- active/orphaned Anvil processes;
- simulation duration/success/error class;
- Groq calls/tokens/rate-limit responses;
- strategy verification counts;
- mainnet execution mismatch count.

Never log API keys, auth tokens, wallet signatures beyond what is necessary, or user-sensitive headers.

---

## 23. Deployment

### Frontend

Next.js can deploy to Vercel or any Node/Docker host.

### API/indexer/simulator

Use Docker-capable persistent compute. Simulator requires Foundry binaries and process management; do not deploy it as a serverless function.

Initial low-cost topology can colocate API, indexer, Redis, and simulator workers on one machine, but keep them as separate processes/containers so they can split later.

MongoDB may be Atlas. Redis may be managed or containerized.

### Network security

- only web/API exposed publicly;
- Mongo/Redis private or authenticated/network-restricted;
- Anvil private localhost/container network only;
- CORS explicit;
- API rate limiting;
- health endpoints distinguish liveness/readiness.

---

## 24. CI/CD

Pull-request checks:

- install from lockfile;
- lint;
- typecheck;
- unit tests;
- build all apps;
- security/secret scan;
- pure integration tests with local Mongo/Redis.

Scheduled/manual/main-branch real-chain checks:

- verify current contract registry has bytecode;
- Base archive read test;
- Ethereum governance read test;
- pinned historical fork acceptance test;
- end-to-end simulation receipt reproduction.

Do not burn free RPC/Groq quotas on every trivial local edit.

---

## 25. Testing without mocks

The user requires no mocks.

Interpretation for this project:

- Pure functions may use deterministic static test vectors as inputs.
- No fake external service implementation may stand in for Base, Ethereum, Moonwell, Anvil, Mongo, Redis, or Groq in acceptance/integration paths.
- Integration tests use real local Mongo/Redis containers and real Anvil forks of real chain state.
- Governance acceptance tests use real historical/current logs.
- Agent acceptance tests call Groq when the corresponding env flag/credentials are enabled.
- CI may separate fast pure tests from quota-consuming real-integration jobs, but the release gate must run the real tests.

Never check in JSON that claims to be an RPC result and use it as proof of live product behavior.

---

## 26. Implementation edge cases

In addition to PRD cases, the technical implementation must cover:

- bigint serialization across HTTP/Mongo;
- token decimals and symbols changing/being malicious;
- proxy contracts and implementation upgrades;
- `eth_getLogs` provider range limits;
- provider rate limit 429s;
- archive provider pruning/missing trie state;
- fork process port collision;
- zombie Anvil process after worker crash;
- snapshot/revert failure;
- simulation branch ordering;
- duplicated approvals;
- fee-on-transfer/rebasing/nonstandard ERC20 behavior (mark unsupported unless tested);
- same transaction containing several governance actions;
- proposal revision/splitting under newer Moonwell governor semantics;
- execution windows/expiry introduced by MultichainGovernorV2;
- Wormhole fee/payload behavior changing;
- downstream target proxy upgraded after proposal creation;
- stale ABI;
- contract code hash mismatch;
- unsupported selector;
- user has debt in multiple markets;
- adding collateral in a different eligible market changes account liquidity globally;
- repay-on-behalf semantics;
- market paused mid-run;
- gas estimate too high for wallet;
- allowance race;
- wallet sends different transaction than prepared plan;
- smart-wallet batch semantics;
- mainnet tx dropped/replaced;
- SSE reconnect/backfill;
- queue job deduplication after process restart;
- Mongo unique-index race;
- Groq provider outage/model deprecation;
- model context overflow;
- model prompt injection from untrusted onchain strings.

---

## 27. Required documentation generated during implementation

Codex must maintain:

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/PROTOCOL_RESEARCH.md`
- `docs/CONTRACT_REGISTRY.md`
- `docs/DEPENDENCY_DECISIONS.md`
- `docs/ENVIRONMENT.md`
- `docs/RUNBOOK.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/ADR/*.md` for material architecture decisions.

At the end, `README.md` must be sufficient for a new engineer to install prerequisites, configure env, run local services, run the real-chain simulation, start web/API/workers, run tests, and understand what is genuinely supported.
