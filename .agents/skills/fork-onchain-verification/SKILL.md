# fork-onchain-verification

Use before changing Moonwell addresses, ABIs, governance decoding, historical replay, or Anvil simulation.

1. Read official Moonwell docs and `moonwell-contracts-v2` / `moonwell-sdk` at a recorded commit.
2. Confirm the address on the expected chain with `eth_getCode`. Store block number and hash.
3. Prefer contract state over proposal prose.
4. Unknown selectors are `UNSUPPORTED`. Do not guess.
5. Record findings in `docs/PROTOCOL_RESEARCH.md` and `docs/CONTRACT_REGISTRY.md`.
6. Never mark a strategy verified without a real-fork post-state check.
