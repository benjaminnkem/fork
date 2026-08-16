import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface MonitoringMetrics {
  lastTickAt: string;
  ethereum: {
    cursorBlock: string;
    cursorHash: string;
    safeBlock: string;
    lagBlocks: string;
    reorgDetected: boolean;
    upserted: number;
    refreshed: number;
  };
  base: {
    cursorBlock: string;
    cursorHash: string;
    safeBlock: string;
    lagBlocks: string;
    reorgDetected: boolean;
    updated: number;
  };
  staleMarked: number;
  enqueued: number;
  monitoredWallets: number;
}

export function writeMetrics(path: string, metrics: MonitoringMetrics): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(metrics, null, 2)}\n`);
}

export function readMetrics(path: string): MonitoringMetrics | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as MonitoringMetrics;
  } catch {
    return undefined;
  }
}
