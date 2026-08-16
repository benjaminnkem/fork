import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, loadRootEnv } from "@fork/config";
import { MemoryGovernanceStore } from "@fork/governance-core";
import { JsonFileGovernanceStore } from "@fork/protocol-moonwell";
import { impactJobId } from "@fork/governance-core";
import { readMetrics, writeMetrics } from "./metrics.js";
import { runMonitorTick } from "./monitor.js";

loadRootEnv();
const live = process.env.RUN_INDEXER === "1";

describe("monitor persistence", () => {
  it("survives restart by reloading both chain cursors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fork-monitor-"));
    const path = join(dir, "governance-store.json");
    const first = new JsonFileGovernanceStore(path);
    await first.saveCursor({
      sourceId: "moonwell-ethereum-governor",
      chainId: 1,
      lastProcessedBlock: 100n,
      lastProcessedBlockHash: "0xaaa",
      lastProposalId: 176n,
      updatedAt: new Date("2026-08-16T00:00:00.000Z"),
    });
    await first.saveCursor({
      sourceId: "moonwell-base-destination",
      chainId: 8453,
      lastProcessedBlock: 200n,
      lastProcessedBlockHash: "0xbbb",
      lastProposalId: 0n,
      updatedAt: new Date("2026-08-16T00:00:00.000Z"),
    });
    const second = new JsonFileGovernanceStore(path);
    const eth = await second.getCursor("moonwell-ethereum-governor");
    const base = await second.getCursor("moonwell-base-destination");
    expect(eth?.lastProcessedBlock).toBe(100n);
    expect(base?.lastProcessedBlock).toBe(200n);
    expect((await second.listCursors()).map((cursor) => cursor.sourceId).sort()).toEqual([
      "moonwell-base-destination",
      "moonwell-ethereum-governor",
    ]);
  });

  it("writes metrics a later process can read", () => {
    const dir = mkdtempSync(join(tmpdir(), "fork-metrics-"));
    const path = join(dir, "monitoring-metrics.json");
    writeMetrics(path, {
      lastTickAt: "2026-08-16T00:00:00.000Z",
      ethereum: {
        cursorBlock: "10",
        cursorHash: "0x1",
        safeBlock: "12",
        lagBlocks: "2",
        reorgDetected: false,
        upserted: 1,
        refreshed: 0,
      },
      base: {
        cursorBlock: "20",
        cursorHash: "0x2",
        safeBlock: "20",
        lagBlocks: "0",
        reorgDetected: false,
        updated: 1,
      },
      staleMarked: 0,
      enqueued: 0,
      monitoredWallets: 1,
    });
    expect(readMetrics(path)?.ethereum.lagBlocks).toBe("2");
  });

  it("keeps impact job ids colon-free for BullMQ", () => {
    expect(impactJobId("0xAb", "moonwell:eth:176")).not.toContain(":");
  });

  it("does not treat a hand-written metrics file as source of financial results", () => {
    const dir = mkdtempSync(join(tmpdir(), "fork-metrics-"));
    const path = join(dir, "monitoring-metrics.json");
    writeFileSync(path, JSON.stringify({ lastTickAt: "x" }));
    expect(readMetrics(path)?.lastTickAt).toBe("x");
  });
});

describe.skipIf(!live)("live monitor tick", () => {
  it(
    "reads real Ethereum/Base heads and advances cursors",
    { timeout: 180_000 },
    async () => {
      const config = loadConfig();
      const dir = mkdtempSync(join(tmpdir(), "fork-live-monitor-"));
      const result = await runMonitorTick({
        config,
        store: new MemoryGovernanceStore(),
        metricsPath: join(dir, "monitoring-metrics.json"),
      });
      expect(result.metrics.ethereum.cursorBlock).toMatch(/^\d+$/);
      expect(Number(result.metrics.ethereum.safeBlock)).toBeGreaterThan(0);
    },
  );
});
