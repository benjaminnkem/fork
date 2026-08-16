import type { BlockAnchor } from "@fork/shared";
import { ForkError } from "@fork/shared";
import type { ForkChainClient } from "./clients.js";
import { assertChainId } from "./clients.js";
import { withRpcRetry } from "./retry.js";

export type AnchorFinality = BlockAnchor["finality"];

function toAnchor(
  forkClient: ForkChainClient,
  block: { number: bigint; hash: `0x${string}` | null; timestamp: bigint },
  finality: AnchorFinality,
): BlockAnchor {
  if (!block.hash) {
    throw new ForkError("RPC_INCONSISTENT_STATE", "Block is missing a hash", {
      details: { chainId: forkClient.chainId, blockNumber: block.number.toString() },
    });
  }
  return {
    chainId: forkClient.chainId,
    blockNumber: block.number,
    blockHash: block.hash,
    timestamp: Number(block.timestamp),
    finality,
    rpcProviderId: forkClient.providerId,
  };
}

export async function getBlockAnchor(
  forkClient: ForkChainClient,
  finality: Exclude<AnchorFinality, "historical">,
): Promise<BlockAnchor> {
  await assertChainId(forkClient);
  const block = await withRpcRetry(`getBlock(${forkClient.chainId},${finality})`, () =>
    forkClient.client.getBlock({ blockTag: finality }),
  );
  const anchor = toAnchor(forkClient, block, finality);

  const byHash = await withRpcRetry(`getBlockByHash(${forkClient.chainId})`, () =>
    forkClient.client.getBlock({ blockHash: anchor.blockHash }),
  );
  if (byHash.number !== anchor.blockNumber || byHash.hash !== anchor.blockHash) {
    throw new ForkError(
      "RPC_INCONSISTENT_STATE",
      "Block hash/number mismatch between tagged and hash lookups",
      {
        details: {
          taggedNumber: anchor.blockNumber.toString(),
          hashedNumber: byHash.number.toString(),
        },
      },
    );
  }
  return anchor;
}

export async function getHistoricalAnchor(
  forkClient: ForkChainClient,
  blockNumber: bigint,
): Promise<BlockAnchor> {
  await assertChainId(forkClient);
  const block = await withRpcRetry(`getBlock(${forkClient.chainId},#${blockNumber})`, () =>
    forkClient.client.getBlock({ blockNumber }),
  );
  if (block.number !== blockNumber) {
    throw new ForkError(
      "RPC_INCONSISTENT_STATE",
      "Provider returned a different historical block than requested",
      {
        details: {
          requested: blockNumber.toString(),
          received: block.number.toString(),
        },
      },
    );
  }
  return toAnchor(forkClient, block, "historical");
}

export interface ChainReadiness {
  ok: boolean;
  chainId?: number;
  blockNumber?: string;
  blockHash?: string;
  providerId?: string;
  error?: string;
}

export async function checkChainReadiness(forkClient: ForkChainClient): Promise<ChainReadiness> {
  try {
    const anchor = await getBlockAnchor(forkClient, "latest");
    return {
      ok: true,
      chainId: anchor.chainId,
      blockNumber: anchor.blockNumber.toString(),
      blockHash: anchor.blockHash,
      providerId: forkClient.providerId,
    };
  } catch (error) {
    return {
      ok: false,
      providerId: forkClient.providerId,
      error: error instanceof Error ? error.message : "unknown RPC error",
    };
  }
}
