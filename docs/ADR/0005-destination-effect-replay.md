# ADR 0005 — Destination-effect replay

- Status: accepted
- Date: 2026-08-16

Do not reconstruct Wormhole VAAs. Replay the exact Base destination calldata by impersonating the Temporal Governor on a private Anvil fork pinned to block number and hash. Record impersonation and never write storage slots directly.
