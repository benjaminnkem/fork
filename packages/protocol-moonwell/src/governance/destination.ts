import { getRequiredContract, moonwellComptrollerAbi } from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { getBlockAnchor, withRpcRetry } from "@fork/blockchain";
import {
  applyReorgRollback,
  combineChangeStatus,
  cursorHashMismatch,
  type GovernanceStore,
  type IndexCursor,
} from "@fork/governance-core";
import {
  BASE_CHAIN_ID,
  ForkError,
  type Address,
  type Hex,
  type ProtocolChangeStatus,
} from "@fork/shared";
import { decodeSetCollateralFactor } from "./decode.js";

export const BASE_DESTINATION_SOURCE = "moonwell-base-destination";

export function destinationStatusFromFactor(input: {
  sourceStatus: ProtocolChangeStatus;
  currentFactor?: bigint;
  targetFactor?: bigint;
}): ProtocolChangeStatus {
  if (input.sourceStatus === "CANCELLED" || input.sourceStatus === "EXPIRED") {
    return input.sourceStatus;
  }
  if (
    input.sourceStatus === "EXECUTED" &&
    input.currentFactor !== undefined &&
    input.targetFactor !== undefined &&
    input.currentFactor === input.targetFactor
  ) {
    return "EXECUTED";
  }
  if (input.sourceStatus === "EXECUTED") return "DESTINATION_PENDING";
  return "UNKNOWN";
}

async function detectReorg(base: ForkChainClient, cursor: IndexCursor | undefined): Promise<boolean> {
  if (!cursor) return false;
  try {
    const block = await withRpcRetry("base_getBlockByNumber(cursor)", () =>
      base.client.getBlock({ blockNumber: cursor.lastProcessedBlock }),
    );
    return cursorHashMismatch(cursor.lastProcessedBlockHash, (block.hash ?? undefined) as Hex | undefined);
  } catch {
    return true;
  }
}

export async function refreshDestinationStatuses(input: {
  base: ForkChainClient;
  store: GovernanceStore;
}): Promise<{ updated: number; cursor: IndexCursor; reorgDetected: boolean }> {
  if (input.base.chainId !== BASE_CHAIN_ID) {
    throw new ForkError("INVALID_CONFIG", "Destination refresh requires a Base client");
  }
  const previous = await input.store.getCursor(BASE_DESTINATION_SOURCE);
  const reorgDetected = await detectReorg(input.base, previous);
  const safe = await getBlockAnchor(input.base, "safe");
  const comptroller = getRequiredContract(BASE_CHAIN_ID, "comptroller").address as Address;
  let updated = 0;
  for (const record of await input.store.listIndexedChanges()) {
    if (record.change.type !== "COLLATERAL_FACTOR_CHANGE") continue;
    const cfCall = record.change.targetCalls.find(
      (call) => call.decoded?.functionName === "_setCollateralFactor",
    );
    if (!cfCall) continue;
    let target: { market: Address; newCollateralFactorMantissa: bigint };
    try {
      target = decodeSetCollateralFactor(cfCall.calldata);
    } catch {
      continue;
    }
    const listing = await withRpcRetry(`comptroller.markets(${target.market})`, () =>
      input.base.client.readContract({
        address: comptroller,
        abi: moonwellComptrollerAbi,
        functionName: "markets",
        args: [target.market],
        blockNumber: safe.blockNumber,
      }),
    );
    const destinationStatus = destinationStatusFromFactor({
      sourceStatus: record.sourceStatus,
      currentFactor: listing[1],
      targetFactor: target.newCollateralFactorMantissa,
    });
    const next = {
      ...record,
      destinationStatus,
      change: {
        ...record.change,
        status: combineChangeStatus(record.sourceStatus, destinationStatus, true),
        updatedAt: new Date(safe.timestamp * 1000),
        evidence: [
          ...record.change.evidence,
          {
            type: "CONTRACT_CALL" as const,
            chainId: BASE_CHAIN_ID,
            blockNumber: safe.blockNumber.toString(),
            blockHash: safe.blockHash,
            address: comptroller,
            method: "markets",
          },
        ],
      },
    };
    if (next.destinationStatus !== record.destinationStatus || next.change.status !== record.change.status) {
      await input.store.upsertIndexedChange(next);
      updated += 1;
    }
  }

  let cursor: IndexCursor = {
    sourceId: BASE_DESTINATION_SOURCE,
    chainId: BASE_CHAIN_ID,
    lastProcessedBlock: safe.blockNumber,
    lastProcessedBlockHash: safe.blockHash,
    lastProposalId: previous?.lastProposalId ?? 0n,
    updatedAt: new Date(),
  };
  if (reorgDetected && previous) {
    cursor = { ...applyReorgRollback(previous, safe.blockNumber), lastProcessedBlockHash: safe.blockHash };
  }
  await input.store.saveCursor(cursor);
  return { updated, cursor, reorgDetected };
}
