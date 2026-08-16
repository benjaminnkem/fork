# AGENTS.md — Fork repository instructions

## Mission

Build Fork as a real, production-shaped DeFi pre-execution risk agent. Read `PRD.md`, `TECHNICAL_SPECIFICATION.md`, `SECURITY_AND_THREAT_MODEL.md`, and `PLANS.md` before implementing material functionality.

## Engineering standard

Work as a senior/staff engineer experienced in TypeScript, distributed systems, EVM/Web3, DeFi lending, governance, security, and AI agents. Prefer explicit, testable, boring-correct architecture over hackathon shortcuts.

## Non-negotiable rules

1. No mocked Base/Ethereum/Moonwell/governance data in product, integration, E2E, or release acceptance paths.
2. Never fabricate transaction hashes, governance payloads, wallet positions, or simulation results.
3. Never hard-code a Moonwell address/ABI/governance assumption without provenance and verification.
4. Never use the LLM to calculate or assert solvency when contracts can determine it.
5. Never expose unrestricted shell, arbitrary RPC, arbitrary DB, arbitrary HTTP, or arbitrary transaction tools to the production agent.
6. Never store user private keys/seed phrases. Mainnet user actions require client-side wallet signing.
7. Never mark a strategy safe until deterministic post-state invariants pass on a real mainnet fork.
8. Never use JavaScript floating point for token accounting. Use `bigint`/decimal strings.
9. Unknown/ambiguous critical protocol semantics must fail closed. Research official primary sources; if still genuinely ambiguous and the choice materially affects correctness or security, ask the user before proceeding.
10. Do not add unsupported protocol logos/features just for appearance.

## Repository workflow

- Package manager: pnpm.
- Keep TypeScript strict.
- Follow package boundaries in the technical spec.
- Prefer viem for blockchain interactions.
- Use BullMQ for expensive/background work.
- Simulator worker owns Anvil process lifecycle.
- Keep protocol-specific logic inside `protocol-moonwell`.
- Keep AI orchestration inside `agent-core`; deterministic tools outside it.
- Keep durable audit/proof data in MongoDB.

## Research discipline

Before implementing Moonwell governance or transaction semantics:

- consult current official Moonwell docs/repositories and current onchain bytecode/state;
- record exact URLs, commit hashes, chain IDs, contract addresses, ABI provenance, and findings in `docs/PROTOCOL_RESEARCH.md` and `docs/CONTRACT_REGISTRY.md`;
- note that Moonwell migrated core governance to Ethereum in 2026 and do not assume old Moonbeam-source architecture;
- verify Base destination execution semantics.

Do not use a blog/tutorial as the authority when an official contract/repository/doc exists.

## AI rules

Primary Groq model: `openai/gpt-oss-120b`. Fallback/light model: `openai/gpt-oss-20b`. Model IDs are env-configurable.

Use local function calling. Validate every tool-call argument. Enforce max steps/time/tokens. Set production requests not to expose hidden reasoning. Product agent traces are application-level summaries/evidence, not raw chain-of-thought.

## Testing rules

After every phase:

- run lint;
- run typecheck;
- run relevant tests;
- run the real-chain acceptance test when the phase changes protocol/simulation logic;
- update `docs/IMPLEMENTATION_STATUS.md` with completed/remaining work and known limitations.

Do not claim a phase complete while tests fail.

## Documentation rules

When introducing an env var, add it immediately to `.env.example` and `docs/ENVIRONMENT.md` with required/optional, service, purpose, example format, and secret/public classification.

When making a material architecture decision, create/update an ADR.

At the end of each build phase, report:

1. what you changed;
2. key files;
3. tests run/results;
4. new env vars/prerequisites;
5. manual setup required from the user;
6. risks/limitations;
7. exact next prompt/phase readiness.

## Dependency policy

Before adding a production dependency, confirm it has a real need and is actively maintained/compatible. Prefer first-party/official SDKs and direct viem calls over thin wrappers. Commit lockfile changes.

## Security review rules

Treat any change touching:

- governance decoding;
- fork impersonation;
- strategy transaction construction;
- wallet authentication/signing;
- LLM tools;
- secrets;
- mainnet execution

as security-sensitive and run the relevant release-gate checks.
