import { describe, expect, it } from "vitest";
import { classifyExecutionState } from "./verify-state.js";

describe("classifyExecutionState", () => {
  it("marks success from post-state, not from a receipt alone", () => {
    const base = {
      expected: { maxShortfallRaw: "0", minSafetyBufferBps: 0 },
      before: { status: "SHORTFALL" as const, liquidityRaw: 0n, shortfallRaw: 10n },
      submittedCalls: 2,
      confirmedCalls: 2,
      reverted: false,
    };
    expect(
      classifyExecutionState({
        ...base,
        after: { status: "SAFE", liquidityRaw: 5n, shortfallRaw: 0n },
      }),
    ).toBe("VERIFIED");
    expect(
      classifyExecutionState({
        ...base,
        after: { status: "SHORTFALL", liquidityRaw: 0n, shortfallRaw: 10n },
      }),
    ).toBe("MISMATCH");
    expect(
      classifyExecutionState({
        ...base,
        confirmedCalls: 1,
        after: { status: "SHORTFALL", liquidityRaw: 0n, shortfallRaw: 10n },
      }),
    ).toBe("PARTIAL");
    expect(
      classifyExecutionState({
        ...base,
        reverted: true,
        after: { status: "SHORTFALL", liquidityRaw: 0n, shortfallRaw: 10n },
      }),
    ).toBe("FAILED");
  });
});
