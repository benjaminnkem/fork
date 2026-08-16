# fork-release-gate

Use before claiming a phase or release is done.

1. No mocked Base/Ethereum/Moonwell/Groq data in acceptance paths.
2. `pnpm lint`, `pnpm check-types`, relevant tests, and real-chain checks if protocol/simulation changed.
3. `.env.example` and `docs/ENVIRONMENT.md` match new variables.
4. `docs/IMPLEMENTATION_STATUS.md` lists remaining limitations honestly.
5. Historical replay, if shown, recomputes from a real block and real action.
