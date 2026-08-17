# Fork — Engineering Handoff Kit

**Prepared:** 2026-08-15  
**Updated:** 2026-08-17 (Phase 15 handoff)  
**Purpose:** Give a coding agent or new engineer enough product, architecture, security, protocol, testing, and execution context to run and extend Fork.

Practical start: root `README.md` then `docs/HANDOFF.md`. Live gate: `docs/RELEASE_GATE.md`.

## What Fork is

Fork is an autonomous DeFi pre-execution risk agent. It watches authoritative protocol-governance changes before they reach a user's live position, reconstructs the relevant future protocol state on a real mainnet fork, measures the user's position before and after the change, searches for bounded rescue strategies, executes those strategies in counterfactual branches, and returns only strategies that the EVM proves satisfy the user's safety policy.

The first production adapter is **Moonwell Core lending on Base Mainnet**. Moonwell is not the product; it is Protocol Adapter #1.

## Core engineering principle

> **The model proposes. The EVM proves.**

The LLM may decide what to investigate or which strategy class to try. It must never be trusted to calculate solvency, invent protocol state, claim a transaction succeeded, or authorize arbitrary mainnet calldata.

## Read these files in this order

1. `HANDOFF.md` — setup, env-by-app, deploy, tests, replay, signing, what not to touch.
2. `PRD.md` — complete product definition and acceptance criteria.
3. `TECHNICAL_SPECIFICATION.md` — implementation architecture, data model, APIs, queues, protocol adapter, simulation system, agent loop, and production concerns.
4. `SECURITY_AND_THREAT_MODEL.md` — mandatory safety boundaries for a financial/agentic system.
5. `AGENTS.md` — repository-wide instructions (also at the repo root).
6. `PLANS.md` — execution-plan rules for long-running work.
7. `CODEX_BUILD_PROMPTS.md` — ordered build phases (0–15).
8. `ENVIRONMENT_AND_OPERATIONS.md` — environment variables, local setup, deployment topology.
9. `TESTING_AND_RELEASE.md` — test matrix and release checklist.
10. `RELEASE_GATE.md` — last live gate timings and receipt hash.
11. `SOURCES.md` — primary documentation and repositories.
12. `.agents/skills/fork-onchain-verification/SKILL.md` — evidence-first protocol/simulation work.
13. `.agents/skills/fork-release-gate/SKILL.md` — production release validation.

## Non-negotiable product rules

- No mocked RPC responses.
- No fabricated governance proposal or calldata.
- No fake transaction hashes.
- No precomputed/fake risk outcomes.
- No fake agent tool traces.
- No backend custody of user private keys or seed phrases.
- No arbitrary transaction execution tool exposed to the model.
- No claim that a strategy is safe until it has passed deterministic post-state checks on a real fork.
- No hard-coded Moonwell governance architecture assumptions without verifying current official contracts/repositories and onchain state.
- No unsupported protocol logos in production UI.
- Historical replay, if enabled, must use a real historical block, real deployed contracts, a real governance action, and preferably a real historical wallet position. Synthetic “demo disasters” are not acceptable.

## Locked V1 product scope

- Chain whose user positions are protected: **Base Mainnet (8453)**.
- Governance source chain for current Moonwell primary governance: **Ethereum Mainnet**, subject to adapter verification because governance architecture is upgradeable.
- Protocol: **Moonwell Core lending markets on Base**.
- Core change classes: collateral/risk-parameter changes that materially affect borrowing safety; the implementation may add closely related risk changes only after deterministic support exists.
- Rescue strategy classes: **repay debt** and **add collateral**.
- AI provider: **Groq**, with `openai/gpt-oss-120b` as the high-capability planner and `openai/gpt-oss-20b` as the cheaper/fallback model.
- Agent design: custom NestJS local-tool-calling loop; no LangChain/CrewAI dependency required for the core.
- Mainnet writes: user-signed only, after simulation and explicit confirmation.

## What “done” means

Fork is not done because the UI looks good. V1 is done when a real Base wallet with a supported Moonwell position can be analyzed; a real authoritative Moonwell change can be discovered and normalized; the exact Base-side effect can be executed against a pinned Base mainnet fork; before/after risk can be read from real Moonwell contracts; rescue candidates can be optimized and simulated; a proof receipt can be reproduced; and a supported rescue transaction can be prepared for the user to sign on Base Mainnet.
