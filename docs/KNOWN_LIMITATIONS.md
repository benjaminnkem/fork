# Known limitations

- Phase 3 reconstructs Ethereum governor proposals and Base destination CF calls. Destination Temporal Governor queue/execute logs are not ingested yet (Alchemy free `eth_getLogs` is limited to 10 blocks). Destination status stays `DESTINATION_PENDING` after source execution unless later proven.
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
