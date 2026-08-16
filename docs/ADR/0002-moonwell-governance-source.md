# ADR 0002 — Current Moonwell governance source

- Status: accepted
- Date: 2026-08-16

Treat Ethereum Mainnet Multichain Governor `0x8769B70ac7c93AF0e75de0D69877709B66d75838` as the current primary source of Moonwell governance, and Base Temporal Governor `0x8b621804a7637b781e2BbD58e256a591F2dF7d51` as the destination executor.

Do not implement a Moonbeam-source indexer as the live path. The contracts-repo README that still says Moonbeam is source of truth is stale relative to MIP-X58, the official contracts page, SDK 0.22.0, and onchain bytecode.
