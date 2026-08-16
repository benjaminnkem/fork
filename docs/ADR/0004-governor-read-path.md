# ADR 0004 — Governor read path

- Status: accepted
- Date: 2026-08-16

Index Moonwell governance from Ethereum `getProposalData` / `state` / `proposalVotes`, not from proposal prose. Destination Base effects are decoded from Wormhole `publishMessage` payloads as `(temporalGovernor, targets, values, calldatas)`. Unknown selectors stay `UNKNOWN`. Logs are optional evidence; they are not required to reconstruct destination calldata.
