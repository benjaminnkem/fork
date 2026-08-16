# Known limitations

- Replay is `DESTINATION_EFFECT_REPLAY`, not a full Wormhole/Temporal Governor VAA replay. Anvil impersonates the Temporal Governor and sends the exact destination calldata.
- Fork startup needs archive RPC and can take well over 15s. Default `FORK_START_TIMEOUT_MS` is 180000.
- Pre-169 proposal IDs on the Ethereum governor have empty calldata.
- Archive capability is not proven until a real historical fork in Phase 4. A provider that answers `eth_blockNumber` may still fail on old state.
- Public Base RPC remains fallback-only and is rate-limited. Ethereum has no default public fallback unless `ETHEREUM_FALLBACK_RPC_URL` is set.
- Moonwell Views addresses disagree between official docs and SDK 0.22.0. Unused until re-verified.
- `moonwell-contracts-v2` README still describes Moonbeam as the governor source. Ignored in favor of official contracts + MIP-X58 + onchain state.
- MultichainGovernorV2 implementation ABI is not pinned yet.
- Temporal Governor owner `0x4463…779e` is observed, not identified.
- `DEFAULT_MIN_SAFETY_BUFFER_BPS` is intentionally unset.
- TypeScript remains 5.9.2 even though npm latest is 7.x.
- Web UI is a placeholder page with no product data.
