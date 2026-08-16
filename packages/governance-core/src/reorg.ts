import type { Hex } from "@fork/shared";
import type { IndexCursor } from "./store.js";

export const REORG_LOOKBACK_BLOCKS = 64n;

export function cursorHashMismatch(
  storedHash: Hex | undefined,
  currentHash: Hex | undefined,
): boolean {
  if (!storedHash || !currentHash) return Boolean(storedHash);
  return storedHash.toLowerCase() !== currentHash.toLowerCase();
}

export function rollbackCursorBlock(lastProcessedBlock: bigint, lookback = REORG_LOOKBACK_BLOCKS): bigint {
  return lastProcessedBlock > lookback ? lastProcessedBlock - lookback : 0n;
}

export function applyReorgRollback(cursor: IndexCursor, safeBlock: bigint): IndexCursor {
  const rolled = rollbackCursorBlock(cursor.lastProcessedBlock);
  return {
    ...cursor,
    lastProcessedBlock: rolled < safeBlock ? rolled : safeBlock,
    updatedAt: new Date(),
  };
}

export function indexLagBlocks(safeBlock: bigint, cursorBlock: bigint): string {
  if (safeBlock <= cursorBlock) return "0";
  return (safeBlock - cursorBlock).toString();
}

export function impactJobId(wallet: string, changeId: string): string {
  return `impact-${wallet.toLowerCase()}-${changeId.replaceAll(":", "-")}`;
}

export function shouldRefreshSimulations(previousStatus: string | undefined, nextStatus: string): boolean {
  if (!previousStatus) return false;
  return previousStatus !== nextStatus;
}

export function shouldCancelOpenSimulations(nextStatus: string): boolean {
  return nextStatus === "CANCELLED" || nextStatus === "EXPIRED";
}

export function shouldEnqueueImpact(input: {
  monitoringEnabled: boolean;
  relevant: boolean;
  supportLevel: string;
  changeId: string;
  status: string;
  statusChanged: boolean;
  firstRelevant: boolean;
}): boolean {
  if (!input.monitoringEnabled || !input.relevant) return false;
  if (input.status === "CANCELLED" || input.status === "EXPIRED") return false;
  if (input.supportLevel !== "DESTINATION_EFFECT_REPLAY") return false;
  if (!input.changeId.endsWith(":176") && input.changeId !== "moonwell:eth:176") return false;
  return input.statusChanged || input.firstRelevant;
}
