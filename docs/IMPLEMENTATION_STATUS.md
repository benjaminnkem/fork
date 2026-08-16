# Implementation status

**Phase:** 1 — blockchain/RPC foundation  
**Date:** 2026-08-16

## Done

- Phase 0 research + skeleton.
- viem public clients for Base `8453` and Ethereum `1` with primary/fallback transports.
- Chain-ID validation, latest/safe/finalized/historical anchors (number + hash), bigint-safe JSON.
- Typed RPC error classification and bounded retry.
- Pinned Moonwell registry bytecode checks against live RPCs.
- `pnpm verify:contracts`, `pnpm chain:smoke`, and real-chain Vitest gated on env.
- API `/health/ready` probes configured RPCs.

## Not done (by design)

- No Moonwell position reads (Phase 2).
- No governance decoding/indexing (Phase 3).
- No Anvil forks or simulations (Phase 4).
- No Groq agent (Phase 7).
- No Mongo/Redis/BullMQ wiring (Phase 8).
- No wallet connect or mainnet tx prep (Phase 9–10).

## Known limitations

See `docs/KNOWN_LIMITATIONS.md`.
