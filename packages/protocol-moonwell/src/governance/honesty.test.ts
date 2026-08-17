import { describe, expect, it } from "vitest";
import { describeReplayHonesty } from "./honesty.js";
import type { SimulationReceipt } from "@fork/simulation-core";

function receipt(afterStatus: "SAFE" | "SHORTFALL"): SimulationReceipt {
  return {
    before: { risk: { status: "SAFE" } },
    after: { risk: { status: afterStatus } },
    liquidityDeltaRaw: "-1",
    materialRisk: {
      classification: afterStatus === "SHORTFALL" ? "SHORTFALL_CREATED" : "LIQUIDITY_REDUCED",
      shortfallDeltaRaw: afterStatus === "SHORTFALL" ? "1" : "0",
    },
  } as SimulationReceipt;
}

describe("describeReplayHonesty", () => {
  it("does not claim insolvency when shortfall is not created", () => {
    const honesty = describeReplayHonesty(receipt("SAFE"));
    expect(honesty.createdShortfall).toBe(false);
    expect(honesty.summary).toContain("did not create insolvency");
  });
});
