import { describe, expect, it } from "vitest";
import { shouldCancelOpenSimulations, shouldRefreshSimulations } from "@fork/governance-core";

describe("stale simulation policy", () => {
  it("cancels open runs when the source is cancelled or expired", () => {
    expect(shouldCancelOpenSimulations("CANCELLED")).toBe(true);
    expect(shouldCancelOpenSimulations("EXPIRED")).toBe(true);
    expect(shouldRefreshSimulations("PROPOSED", "EXECUTED")).toBe(true);
    expect(shouldRefreshSimulations("PROPOSED", "PROPOSED")).toBe(false);
  });
});
