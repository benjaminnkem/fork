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
| wagmi | 3.7.6 | locked for Phase 9; not installed yet |
| mongoose | 9.9.2 | locked for Phase 8; not installed yet |
| bullmq | 6.1.2 | locked for Phase 8; not installed yet |
| groq-sdk | 1.5.0 | locked for Phase 7; not installed yet |
| @moonwell-fi/moonwell-sdk | 0.22.0 | current; used as a research source, not a runtime dep yet |
| Playwright | 1.62.1 | locked for Phase 9 E2E; not installed yet |
| Tailwind | 4.3.3 | locked for Phase 9; not installed in the Phase 0 web skeleton |

## Explicit non-choices

- No LangChain / CrewAI.
- No `llama-3.1-8b-instant`.
- No TypeScript 7 until Nest/Next declare support.
- No Moonwell SDK in the runtime graph until Phase 2 justifies it for metadata only.
