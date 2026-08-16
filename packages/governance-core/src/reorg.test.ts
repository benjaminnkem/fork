import { describe, expect, it } from "vitest";
import {
  applyReorgRollback,
  cursorHashMismatch,
  impactJobId,
  indexLagBlocks,
  rollbackCursorBlock,
  shouldCancelOpenSimulations,
  shouldEnqueueImpact,
} from "./reorg.js";

describe("reorg helpers", () => {
  it("detects a stored cursor hash mismatch", () => {
    expect(cursorHashMismatch("0xaaa", "0xbbb")).toBe(true);
    expect(cursorHashMismatch("0xAAA", "0xaaa")).toBe(false);
    expect(cursorHashMismatch("0xaaa", undefined)).toBe(true);
  });

  it("rolls a cursor back 64 blocks without going negative", () => {
    expect(rollbackCursorBlock(100n)).toBe(36n);
    expect(rollbackCursorBlock(10n)).toBe(0n);
    const rolled = applyReorgRollback(
      {
        sourceId: "moonwell-ethereum-governor",
        chainId: 1,
        lastProcessedBlock: 200n,
        lastProcessedBlockHash: "0x1",
        lastProposalId: 176n,
        updatedAt: new Date(0),
      },
      190n,
    );
    expect(rolled.lastProcessedBlock).toBe(136n);
  });

  it("computes lag and stable job ids", () => {
    expect(indexLagBlocks(200n, 180n)).toBe("20");
    expect(impactJobId("0xAbC", "moonwell:eth:176")).toBe("impact-0xabc-moonwell-eth-176");
  });

  it("enqueues only monitored relevant pinned replays on a transition", () => {
    expect(
      shouldEnqueueImpact({
        monitoringEnabled: true,
        relevant: true,
        supportLevel: "DESTINATION_EFFECT_REPLAY",
        changeId: "moonwell:eth:176",
        status: "DESTINATION_PENDING",
        statusChanged: true,
        firstRelevant: false,
      }),
    ).toBe(true);
    expect(
      shouldEnqueueImpact({
        monitoringEnabled: true,
        relevant: true,
        supportLevel: "DESTINATION_EFFECT_REPLAY",
        changeId: "moonwell:eth:200",
        status: "PROPOSED",
        statusChanged: true,
        firstRelevant: true,
      }),
    ).toBe(false);
    expect(
      shouldEnqueueImpact({
        monitoringEnabled: false,
        relevant: true,
        supportLevel: "DESTINATION_EFFECT_REPLAY",
        changeId: "moonwell:eth:176",
        status: "PROPOSED",
        statusChanged: true,
        firstRelevant: true,
      }),
    ).toBe(false);
    expect(shouldCancelOpenSimulations("CANCELLED")).toBe(true);
    expect(shouldCancelOpenSimulations("PROPOSED")).toBe(false);
  });
});
