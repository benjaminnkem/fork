import { describe, expect, it } from "vitest";
import { ForkError } from "@fork/shared";
import {
  assertPositiveAmount,
  findMinimumPassingAmount,
  minBound,
  V1_STRATEGY_TYPES,
} from "./index.js";

describe("strategy-engine", () => {
  it("locks V1 to repay and add collateral", () => {
    expect(V1_STRATEGY_TYPES).toEqual(["REPAY_DEBT", "ADD_COLLATERAL"]);
  });

  it("rejects non-positive and out-of-bound amounts", () => {
    expect(() => assertPositiveAmount(0n, 10n)).toThrow(ForkError);
    expect(() => assertPositiveAmount(11n, 10n)).toThrow(ForkError);
    expect(() => assertPositiveAmount(4n, 10n)).not.toThrow();
    expect(minBound([9n, 3n, 7n])).toBe(3n);
  });

  it("finds the minimum passing integer by binary search", async () => {
    const tested: bigint[] = [];
    const result = await findMinimumPassingAmount({
      lo: 1n,
      hi: 100n,
      maxProbes: 16,
      test: async (amount) => {
        tested.push(amount);
        return amount >= 37n;
      },
    });
    expect(result.amount).toBe(37n);
    expect(result.complete).toBe(true);
    expect(tested.length).toBeLessThanOrEqual(16);
    expect(tested).toContain(37n);
  });

  it("fails closed when the probe budget is exhausted", async () => {
    const result = await findMinimumPassingAmount({
      lo: 1n,
      hi: 1_000_000n,
      maxProbes: 2,
      test: async (amount) => amount >= 500_000n,
    });
    expect(result.complete).toBe(false);
    expect(result.probes).toHaveLength(2);
  });
});
