import { describe, expect, it } from "vitest";
import { combineChangeStatus, isTerminalChangeStatus, mapMultichainGovernorState } from "./index.js";

describe("governance-core", () => {
  it("treats executed/cancelled/expired as terminal", () => {
    expect(isTerminalChangeStatus("EXECUTED")).toBe(true);
    expect(isTerminalChangeStatus("QUEUED")).toBe(false);
  });

  it("maps MultichainGovernor raw states without guessing new values", () => {
    expect(mapMultichainGovernorState(0)).toBe("PROPOSED");
    expect(mapMultichainGovernorState(5)).toBe("EXECUTED");
    expect(mapMultichainGovernorState(6)).toBe("EXPIRED");
    expect(mapMultichainGovernorState(99)).toBe("UNKNOWN");
  });

  it("keeps destination pending after source execution until dest is proven", () => {
    expect(combineChangeStatus("EXECUTED", "DESTINATION_PENDING", true)).toBe("DESTINATION_PENDING");
    expect(combineChangeStatus("EXECUTED", "EXECUTED", true)).toBe("EXECUTED");
    expect(combineChangeStatus("CANCELLED", "QUEUED", true)).toBe("CANCELLED");
  });
});
