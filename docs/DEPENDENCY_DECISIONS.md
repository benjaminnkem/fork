# Dependency decisions

Recorded 2026-08-16 during Phase 0. Versions are current stables from npm at bootstrap time, except where compatibility forced a pin.

| Package | Version | Why |
|---|---|---|
| Node | >=20 | Nest 11 / Next 16; `.nvmrc` is 20 |
| pnpm | 9.0.0 | already in the repo |
| TypeScript | 5.9.2 | already in the repo; npm latest was 7.0.2, which is too new to adopt mid-bootstrap |
| turbo | 2.10.10 | existing |
| Next.js | 16.3.1 | current stable; App Router |
| React | 19.2.0 | already used by `@repo/ui` |
| NestJS | 11.2.1 | current `@nestjs/core` |
| Zod | 4.4.3 | current; used only for env validation in Phase 0 |
| Pino | 10.3.1 | structured logs |
| Vitest | 4.1.10 | unit/integration runner |
| tsx | 4.20.x | Nest/worker/script runner without a Nest CLI |
| Mongo image | mongo:7 | local compose |
| Redis image | redis:7-alpine | local compose |
| viem | 2.55.16 | locked for Phase 1; not wired yet |
| wagmi | 3.7.6 | Phase 9 wallet connect; injected plus optional WalletConnect |
| mongoose | 9.9.2 | schemas/indexes in `@fork/persistence`; API/simulator connect and create indexes at startup |
| bullmq | 6.1.2 | impact-simulation queue between API and simulator |
| groq-sdk | 1.5.0 | Groq local tool calling in `@fork/agent-core` (Phase 7) |
| @moonwell-fi/moonwell-sdk | 0.22.0 | current; used as a research source, not a runtime dep yet |
| Playwright | 1.62.1 | Phase 9 browser E2E in `apps/web` |
| express | 5.2.1 | Direct API dependency. `apps/api/src/main.ts` imports `json`/`urlencoded` for the 32kb body limit; pnpm isolation does not hoist the Nest transitive copy |
| Tailwind | 4.3.3 | Phase 9 web app + shadcn/ui |

## Explicit non-choices

- No LangChain / CrewAI.
- No `llama-3.1-8b-instant`.
- No TypeScript 7 until Nest/Next declare support.
- No Moonwell SDK in the runtime graph until Phase 2 justifies it for metadata only.
