# Fork — Primary Sources Reviewed

**Research date:** 2026-08-15

The handoff prioritizes primary/official documentation and repositories. Volatile facts must be re-verified by Codex at implementation time.

## Base

- Base — Connecting to Base: https://docs.base.org/base-chain/quickstart/connecting-to-base
- Base — RPC overview: https://docs.base.org/base-chain/api-reference/rpc-overview
- Base — Run a node / public RPC caveat: https://docs.base.org/base-chain/node-operators/run-a-base-node
- Base — Node providers: https://docs.base.org/base-chain/node-operators/node-providers
- Base — Contract addresses: https://docs.base.org/base-chain/network-information/base-contracts

Key facts reviewed:

- Base Mainnet chain ID 8453.
- Base Sepolia chain ID 84532.
- Base public RPC endpoints are rate-limited and documented as unsuitable for production traffic.
- Archive RPC capability exists at the network level; use an appropriate provider for historical forking.

## Moonwell

- Moonwell Docs home: https://docs.moonwell.fi/
- Moonwell contracts: https://docs.moonwell.fi/moonwell/protocol-information/contracts
- Moonwell developer protocol overview: https://docs.moonwell.fi/moonwell/developers/protocol
- Moonwell mTokens: https://docs.moonwell.fi/moonwell/developers/protocol/mtokens
- Moonwell Comptroller interactions: https://docs.moonwell.fi/moonwell/developers/protocol/comptroller/contract-interactions
- Moonwell SDK docs: https://docs.moonwell.fi/moonwell/developers/moonwell-sdk
- Moonwell SDK repository: https://github.com/moonwell-fi/moonwell-sdk
- Moonwell contracts v2 repository: https://github.com/moonwell-fi/moonwell-contracts-v2
- Moonwell Governance: https://docs.moonwell.fi/moonwell/governance/moonwell-governance
- Moonwell governance forum monthly report, May 2026 (MIP-X58 migration context): https://forum.moonwell.fi/t/monthly-governance-reports/787/29
- Moonwell weekly governance recap noting 2026 risk-parameter changes: https://forum.moonwell.fi/t/weekly-governance-recaps/786/128

Key facts reviewed:

- Moonwell is a lending/borrowing protocol with Core markets on Base.
- Base docs list a Moonwell Comptroller and Temporal Governor.
- Moonwell SDK supports current market/user/governance data.
- Moonwell core governance migrated to Ethereum in May 2026 via MIP-X58, while retaining multichain/destination infrastructure.
- Governance and contract topology is upgradeable and must be verified, not treated as permanently hard-coded.

## Foundry / Anvil

- Foundry home: https://getfoundry.sh/
- Anvil: https://getfoundry.sh/anvil
- Anvil reference: https://getfoundry.sh/anvil/reference
- Fork testing guide: https://getfoundry.sh/guides/fork-testing
- Foundry FAQ / impersonation: https://getfoundry.sh/help/faq

Key facts reviewed:

- Anvil supports forking EVM-compatible chains.
- Foundry fork testing supports live-chain state, impersonation, and time-sensitive logic.

## Groq

- Supported models: https://console.groq.com/docs/models
- Tool use: https://console.groq.com/docs/tool-use/overview
- Reasoning: https://console.groq.com/docs/reasoning
- Rate limits: https://console.groq.com/docs/rate-limits
- Model deprecations: https://console.groq.com/docs/deprecations
- GPT-OSS 120B: https://console.groq.com/docs/model/openai/gpt-oss-120b

Key facts reviewed on 2026-08-15:

- `openai/gpt-oss-120b` and `openai/gpt-oss-20b` support local tool use.
- Groq Free Plan table lists 30 RPM, 1K RPD, 8K TPM, 200K TPD for both GPT-OSS 120B and 20B; exact organization limits should be checked in the account.
- `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` are scheduled to shut down for Free/Developer usage on 2026-08-16; official replacements include GPT-OSS models.
- Groq local tool calling allows the application to execute functions itself, which matches Fork's security model.

## wagmi / viem

- wagmi home: https://wagmi.sh/
- Connect wallet: https://wagmi.sh/react/guides/connect-wallet
- viem guide: https://wagmi.sh/react/guides/viem

## NestJS / BullMQ

- NestJS queues: https://docs.nestjs.com/techniques/queues
- NestJS rate limiting: https://docs.nestjs.com/security/rate-limiting
- NestJS MongoDB: https://docs.nestjs.com/techniques/mongodb
- BullMQ overview: https://docs.bullmq.io/
- BullMQ workers: https://docs.bullmq.io/guide/workers
- BullMQ retries: https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ production: https://docs.bullmq.io/guide/going-to-production

## Next.js / Playwright / MongoDB

- Next.js docs: https://nextjs.org/docs
- Next.js App Router: https://nextjs.org/docs/app
- Next.js production checklist: https://nextjs.org/docs/app/guides/production-checklist
- Playwright Test: https://playwright.dev/docs/intro
- Playwright browser isolation: https://playwright.dev/docs/browser-contexts
- MongoDB indexes: https://www.mongodb.com/docs/manual/indexes/
- MongoDB TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/

## Codex, AGENTS.md, skills, and MCP

- Codex AGENTS.md: https://developers.openai.com/codex/agent-configuration/agents-md
- Codex best practices: https://developers.openai.com/codex/learn/best-practices
- Codex skills: https://developers.openai.com/codex/build-skills
- Codex MCP: https://developers.openai.com/codex/mcp
- Codex execution plans: https://developers.openai.com/cookbook/articles/codex_exec_plans
- GitHub official MCP server: https://github.com/github/github-mcp-server
- Microsoft Playwright MCP: https://github.com/microsoft/playwright-mcp
- MongoDB MCP: https://www.mongodb.com/docs/mcp-server/
- MongoDB with Codex: https://www.mongodb.com/docs/codex/

## Source-handling rule for implementation

If current official docs, current official repository code, and onchain bytecode/state disagree, Codex must record the conflict and prefer the evidence that determines actual executable behavior. Security-critical ambiguity must fail closed or be escalated to the user.
