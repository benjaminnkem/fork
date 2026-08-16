import { getRequiredContract, moonwellMultichainGovernorAbi } from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { getBlockAnchor, withRpcRetry } from "@fork/blockchain";
import { combineChangeStatus, mapMultichainGovernorState, type GovernanceStore } from "@fork/governance-core";
import { ETHEREUM_CHAIN_ID, type Address } from "@fork/shared";

export async function refreshIndexedChangeStatuses(input: {
  ethereum: ForkChainClient;
  store: GovernanceStore;
}): Promise<{ updated: number }> {
  const governor = getRequiredContract(ETHEREUM_CHAIN_ID, "multichainGovernor").address as Address;
  const safe = await getBlockAnchor(input.ethereum, "safe");
  let updated = 0;
  for (const record of await input.store.listIndexedChanges()) {
    const proposalId = record.change.proposalId ? BigInt(record.change.proposalId) : undefined;
    if (proposalId === undefined) continue;
    const rawState = await withRpcRetry(`governor.state(${proposalId})`, () =>
      input.ethereum.client.readContract({
        address: governor,
        abi: moonwellMultichainGovernorAbi,
        functionName: "state",
        args: [proposalId],
        blockNumber: safe.blockNumber,
      }),
    );
    const sourceStatus = mapMultichainGovernorState(Number(rawState));
    if (sourceStatus === record.sourceStatus && Number(rawState) === record.rawGovernorState) {
      continue;
    }
    const destinationStatus = record.destinationStatus;
    await input.store.upsertIndexedChange({
      ...record,
      sourceStatus,
      rawGovernorState: Number(rawState),
      change: {
        ...record.change,
        status: combineChangeStatus(sourceStatus, destinationStatus, record.change.targetCalls.length > 0),
        updatedAt: new Date(safe.timestamp * 1000),
      },
    });
    updated += 1;
  }
  return { updated };
}
