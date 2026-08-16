# Contract registry

**Active version:** `moonwell-core-2026-08-16`  
**Machine-readable copy:** `packages/abis/src/registry/moonwell-core-2026-08-16.json`

Override is disabled unless `MOONWELL_ALLOW_REGISTRY_OVERRIDE=true`. Production should keep that false.

## Bytecode check

Performed 2026-08-16 with public RPCs (not an archive proof, only “code exists now”):

- Base `8453` block `50049499` hash `0x447b2326d630d752cd1c91f5d690b5df28d72e9d6fc92e6c1265b10bbf05ee6f` via `https://mainnet.base.org`
- Ethereum `1` block `25768040` hash `0x96b9638a6fef264f8882e7d5c622a956e3d3a6344618dcc2abb88a784ff704fd` via `https://ethereum.publicnode.com`

Re-run:

```bash
pnpm verify:contracts
```

## Required V1 addresses

### Base 8453

| Key | Address | Notes |
|---|---|---|
| comptroller | `0xfBb21d0380beE3312B33c4353c8936a0F13EF26C` | Unitroller; impl `0x73d8a3bf62aaca6690791e57ebaee4e1d875d8fe` |
| temporalGovernor | `0x8b621804a7637b781e2BbD58e256a591F2dF7d51` | Destination executor |
| multichainVoteCollection | `0xe0278B32c627FF6fFbbe7de6A18Ade145603e949` | EIP-1967 |
| chainlinkOracle | `0xEC942bE8A8114bFD0396A5052c36027f2cA6a9d0` | Not canonical solvency |
| wormholeBridgeAdapter | `0x734AbBCe07679C9A6B4Fe3bC16325e028fA6DbB7` | xWELL path |

Core mToken list is in the JSON registry, sourced from official docs. Markets are not automatically “supported” for rescue until Phase 2 tests each one.

### Ethereum 1

| Key | Address | Notes |
|---|---|---|
| multichainGovernor | `0x8769B70ac7c93AF0e75de0D69877709B66d75838` | EIP-1967; impl `0x78c504b6c0ea2adbf6a58b208c9888f3692db169` |
| wormholeBridgeAdapter | `0x734AbBCe07679C9A6B4Fe3bC16325e028fA6DbB7` | Same address, different implementation than Base |

## Provenance rule

A new address may enter this registry only with:

1. official docs and/or official SDK/repo citation;
2. onchain bytecode on the expected chain;
3. an updated registry version string.
