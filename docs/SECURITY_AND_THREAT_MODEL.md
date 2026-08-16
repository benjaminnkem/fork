# Fork — Security & Threat Model

Fork handles financial state and can prepare real DeFi transactions. Security is a product requirement, not a post-hackathon cleanup task.

## 1. Trust boundaries

### Trusted only after verification

- configured protocol contract registry;
- pinned ABI artifacts whose source/provenance is known;
- deterministic Fork code;
- local policy engine;
- Anvil process controlled by simulator worker.

### Untrusted inputs

- any wallet address submitted by user;
- proposal descriptions/URIs/forum text;
- token names/symbols/metadata;
- revert strings;
- Groq output/tool-call arguments;
- public RPC responses until basic consistency checks;
- browser/wallet state;
- external user-supplied URLs;
- Mongo documents from prior versions;
- queue payloads unless schema/version validated.

## 2. Primary assets to protect

- user funds;
- wallet authorization boundary;
- API/RPC/Groq credentials;
- integrity of simulation results;
- integrity of transaction plans;
- governance/event provenance;
- availability of simulation infrastructure;
- audit/proof data.

## 3. Non-negotiable key rule

Fork backend must never request, receive, store, log, or derive a user's seed phrase/private key.

Mainnet actions are prepared server-side only as typed transaction plans and signed by the user's wallet in the browser/smart wallet.

## 4. LLM authority model

Groq is a planner, not an executor.

The LLM may:

- choose which approved analysis tool to call;
- choose among supported strategy classes;
- compare structured verified results;
- explain results.

The LLM may not:

- sign/send mainnet transactions;
- build arbitrary `to/data/value` calls;
- choose arbitrary contract addresses;
- alter risk-policy thresholds;
- mark its own strategy verified;
- directly mutate DB records outside typed services;
- spawn shell processes;
- access raw production secrets.

All model tool arguments are validated and passed through policy checks.

## 5. Prompt injection

Governance descriptions and onchain strings can contain hostile instructions.

Rules:

- never put untrusted text into the system/developer instruction channel;
- wrap as labeled data;
- tool policy is code, not prompt text;
- function selector/address allowlists are code;
- ignore any untrusted text asking the model to reveal secrets, change policies, or call unauthorized tools;
- no unrestricted web/browser tool in the production planner.

## 6. Transaction allowlist

For V1, mainnet transaction preparation supports only adapter-generated methods required for:

- exact/bounded ERC20 approval when necessary;
- Moonwell debt repayment;
- Moonwell collateral supply/enable flow required by supported market.

Each allowed call must have:

- known chain ID;
- known target role/address;
- expected function selector;
- decoded argument validation;
- amount limits derived from user policy;
- simulation proof before preparation.

If contract implementation/address changes unexpectedly, fail closed.

## 7. Simulation integrity

A malicious/buggy simulator can produce false confidence.

Required controls:

- pin block number + hash;
- verify chain ID;
- verify relevant contract bytecode exists;
- capture target code hash when useful;
- record every impersonation/time jump;
- prohibit direct storage mutation in accepted V1 simulations;
- reset/revert between branches;
- verify post-state from Moonwell, not from LLM prose;
- canonical receipt hash;
- reproducibility script.

## 8. RPC risks

Risks:

- malicious/inconsistent provider;
- stale response;
- rate limiting;
- archive-data gaps;
- reorg.

Mitigations:

- provider abstraction with primary/fallback;
- store block hashes;
- use safe/finalized anchors where appropriate;
- optionally cross-check critical block/contract data;
- typed retry policy;
- never silently move to a different historical block when requested block is unavailable.

## 9. Governance ambiguity

Moonwell's governance architecture is upgradeable and migrated in 2026.

Rules:

- current authoritative governor/executor path is a researched, versioned adapter concern;
- unknown selector/path = unsupported;
- proposal prose is not sufficient to execute a future state;
- distinguish source proposal approval from Base destination queue/execution;
- distinguish `FULL_REPLAY` from `DESTINATION_EFFECT_REPLAY`.

## 10. Replay/impersonation safety

Anvil account impersonation is allowed only inside the local private fork.

Never expose an endpoint that lets a user/model choose an arbitrary address to impersonate. Only the adapter can request known governance/executor identities for a known supported replay.

## 11. Authentication

Public wallet reads do not prove ownership.

Any preference mutation or execution association requires signed-nonce wallet authentication with expiry and replay protection.

## 12. Rate limiting/DoS

Simulation is expensive compared to simple reads.

Controls:

- IP/session/wallet rate limits;
- idempotent simulation key;
- queue backpressure;
- concurrency cap;
- max simulation duration;
- max branches;
- max agent steps;
- max Groq tokens/calls;
- process watchdog;
- request body limits.

## 13. Database/Redis

- Mongo/Redis not publicly reachable without auth/network policy;
- least-privilege DB user;
- production auto-index creation disabled after migrations are established;
- queue payload schemas versioned/validated;
- avoid secrets in queue payloads;
- backups for durable proof/audit data.

## 14. Browser/wallet

- explicit Base Mainnet chain check before signing;
- show transaction targets and amounts;
- handle wallet account/network changes;
- no hidden signing;
- no auto-submit after simulation;
- content security policy and dependency hygiene;
- no production wallet connected to Playwright MCP/automated browser sessions.

## 15. Groq availability/deprecation

Groq model IDs and free quotas can change.

Implement `ModelProvider` abstraction and startup model-health checks. A model outage may disable strategy planning but must never cause fallback to guessed financial results.

## 16. Secrets

Server-only env:

- RPC provider keys;
- Groq key;
- Mongo URI;
- Redis credentials;
- session/JWT secret;
- optional monitoring credentials.

Browser only receives public configuration such as chain ID and WalletConnect project ID if used.

Use `.env.example`; never commit actual `.env`.

## 17. Dependency/supply-chain security

- lockfile committed;
- no unreviewed packages merely to save a few lines;
- Dependabot/Renovate optional but recommended;
- secret scanning;
- `pnpm audit`/equivalent reviewed rather than blindly auto-fixing major upgrades;
- pin Foundry/toolchain version for release builds;
- pin Docker image digests where practical.

## 18. Incident behavior

If actual mainnet post-state differs materially from verified expected state:

1. mark execution `MISMATCH`;
2. stop any automatic follow-on action;
3. surface high-severity warning;
4. persist evidence;
5. re-read chain from fallback provider;
6. require explicit human review.

Fork must never hide a failed or uncertain execution to preserve a “successful demo.”
