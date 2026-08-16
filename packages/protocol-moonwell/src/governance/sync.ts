import {
  getRequiredContract,
  moonwellMTokenAbi,
  moonwellMultichainGovernorAbi,
} from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { getBlockAnchor, withRpcRetry } from "@fork/blockchain";
import type { GovernanceStore, IndexCursor } from "@fork/governance-core";
import { ETHEREUM_CHAIN_ID, ForkError, type Address } from "@fork/shared";
import { decodeGovernorProposalData } from "./decode.js";
import { normalizeGovernorProposal } from "./normalize.js";

export const ETHEREUM_GOVERNOR_SOURCE = "moonwell-ethereum-governor";
export const FIRST_ETHEREUM_GOVERNOR_PROPOSAL = 169n;

const REORG_LOOKBACK_BLOCKS = 64n;

export interface GovernanceSyncResult {
  fromProposalId: bigint;
  toProposalId: bigint;
  upserted: number;
  cursor: IndexCursor;
  reorgDetected: boolean;
}

async function detectReorg(
  forkClient: ForkChainClient,
  cursor: IndexCursor | undefined,
): Promise<boolean> {
  if (!cursor) return false;
  try {
    const block = await withRpcRetry("eth_getBlockByNumber(cursor)", () =>
      forkClient.client.getBlock({ blockNumber: cursor.lastProcessedBlock }),
    );
    return block.hash !== cursor.lastProcessedBlockHash;
  } catch {
    return true;
  }
}

export async function readGovernorProposal(
  ethereum: ForkChainClient,
  proposalId: bigint,
  blockNumber?: bigint,
) {
  const governor = getRequiredContract(ETHEREUM_CHAIN_ID, "multichainGovernor").address as Address;
  const [targets, values, calldatas] = await withRpcRetry(`governor.getProposalData(${proposalId})`, () =>
    ethereum.client.readContract({
      address: governor,
      abi: moonwellMultichainGovernorAbi,
      functionName: "getProposalData",
      args: [proposalId],
      blockNumber,
    }),
  );
  const rawState = await withRpcRetry(`governor.state(${proposalId})`, () =>
    ethereum.client.readContract({
      address: governor,
      abi: moonwellMultichainGovernorAbi,
      functionName: "state",
      args: [proposalId],
      blockNumber,
    }),
  );
  const votes = await withRpcRetry(`governor.proposalVotes(${proposalId})`, () =>
    ethereum.client.readContract({
      address: governor,
      abi: moonwellMultichainGovernorAbi,
      functionName: "proposalVotes",
      args: [proposalId],
      blockNumber,
    }),
  );
  return {
    decoded: decodeGovernorProposalData(proposalId, targets, values, calldatas, ETHEREUM_CHAIN_ID),
    rawState: Number(rawState),
    votes,
    targets,
    values,
    calldatas,
  };
}

export async function syncMoonwellGovernor(input: {
  ethereum: ForkChainClient;
  base?: ForkChainClient;
  store: GovernanceStore;
  startProposalId?: bigint;
}): Promise<GovernanceSyncResult> {
  if (input.ethereum.chainId !== ETHEREUM_CHAIN_ID) {
    throw new ForkError("INVALID_CONFIG", "Governor sync requires an Ethereum client");
  }

  const governor = getRequiredContract(ETHEREUM_CHAIN_ID, "multichainGovernor").address as Address;
  const previous = await input.store.getCursor(ETHEREUM_GOVERNOR_SOURCE);
  const reorgDetected = await detectReorg(input.ethereum, previous);
  const safe = await getBlockAnchor(input.ethereum, "safe");

  const proposalCount = await withRpcRetry("governor.proposalCount", () =>
    input.ethereum.client.readContract({
      address: governor,
      abi: moonwellMultichainGovernorAbi,
      functionName: "proposalCount",
      blockNumber: safe.blockNumber,
    }),
  );

  const start =
    input.startProposalId ??
    previous?.lastProposalId ??
    FIRST_ETHEREUM_GOVERNOR_PROPOSAL;
  const fromProposalId = reorgDetected
    ? FIRST_ETHEREUM_GOVERNOR_PROPOSAL
    : start < FIRST_ETHEREUM_GOVERNOR_PROPOSAL
      ? FIRST_ETHEREUM_GOVERNOR_PROPOSAL
      : start;

  let upserted = 0;
  for (let proposalId = fromProposalId; proposalId <= proposalCount; proposalId += 1n) {
    const [targets, values, calldatas] = await withRpcRetry(`governor.getProposalData(${proposalId})`, () =>
      input.ethereum.client.readContract({
        address: governor,
        abi: moonwellMultichainGovernorAbi,
        functionName: "getProposalData",
        args: [proposalId],
        blockNumber: safe.blockNumber,
      }),
    );
    if (targets.length === 0) {
      continue;
    }

    const rawState = await withRpcRetry(`governor.state(${proposalId})`, () =>
      input.ethereum.client.readContract({
        address: governor,
        abi: moonwellMultichainGovernorAbi,
        functionName: "state",
        args: [proposalId],
        blockNumber: safe.blockNumber,
      }),
    );
    const votes = await withRpcRetry(`governor.proposalVotes(${proposalId})`, () =>
      input.ethereum.client.readContract({
        address: governor,
        abi: moonwellMultichainGovernorAbi,
        functionName: "proposalVotes",
        args: [proposalId],
        blockNumber: safe.blockNumber,
      }),
    );

    const decoded = decodeGovernorProposalData(proposalId, targets, values, calldatas, ETHEREUM_CHAIN_ID);

    const affectedAssets: Address[] = [];
    if (input.base) {
      const markets = new Set(
        decoded.destinationBatches.flatMap((batch) =>
          batch.calls
            .filter((call) => call.decoded?.functionName === "_setCollateralFactor")
            .map((call) => String(call.decoded?.args[0])),
        ),
      );
      for (const market of markets) {
        try {
          const underlying = await withRpcRetry(`mtoken.underlying(${market})`, () =>
            input.base!.client.readContract({
              address: market as Address,
              abi: moonwellMTokenAbi,
              functionName: "underlying",
            }),
          );
          affectedAssets.push(underlying as Address);
        } catch {
          continue;
        }
      }
    }

    const record = normalizeGovernorProposal({
      proposal: decoded,
      rawGovernorState: Number(rawState),
      votes,
      discoveredAt: new Date(safe.timestamp * 1000),
      affectedAssets,
      evidence: [
        {
          type: "CONTRACT_CALL",
          chainId: ETHEREUM_CHAIN_ID,
          blockNumber: safe.blockNumber.toString(),
          blockHash: safe.blockHash,
          address: governor,
          method: "getProposalData",
        },
        {
          type: "CONTRACT_CALL",
          chainId: ETHEREUM_CHAIN_ID,
          blockNumber: safe.blockNumber.toString(),
          blockHash: safe.blockHash,
          address: governor,
          method: "state",
        },
      ],
    });

    await input.store.upsertRawEvent({
      id: `eth:proposal:${proposalId}`,
      chainId: ETHEREUM_CHAIN_ID,
      sourceId: ETHEREUM_GOVERNOR_SOURCE,
      blockNumber: safe.blockNumber,
      blockHash: safe.blockHash,
      raw: {
        proposalId: proposalId.toString(),
        rawGovernorState: Number(rawState),
        targets,
        values: values.map((value) => value.toString()),
        calldatas,
        votes: votes.map((value) => value.toString()),
      },
    });
    await input.store.upsertIndexedChange(record);
    upserted += 1;
  }

  const cursor: IndexCursor = {
    sourceId: ETHEREUM_GOVERNOR_SOURCE,
    chainId: ETHEREUM_CHAIN_ID,
    lastProcessedBlock: safe.blockNumber,
    lastProcessedBlockHash: safe.blockHash,
    lastProposalId: proposalCount,
    updatedAt: new Date(),
  };
  if (reorgDetected && previous) {
    const rolled =
      previous.lastProcessedBlock > REORG_LOOKBACK_BLOCKS
        ? previous.lastProcessedBlock - REORG_LOOKBACK_BLOCKS
        : 0n;
    cursor.lastProcessedBlock = rolled < safe.blockNumber ? rolled : safe.blockNumber;
  }
  await input.store.saveCursor(cursor);

  return {
    fromProposalId,
    toProposalId: proposalCount,
    upserted,
    cursor,
    reorgDetected,
  };
}
