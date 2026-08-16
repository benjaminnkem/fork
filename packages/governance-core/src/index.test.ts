import { describe, expect, it } from "vitest";
import { isTerminalChangeStatus } from "./index.js";

describe("governance-core", () => {
  it("treats executed/cancelled/expired as terminal", () => {
    expect(isTerminalChangeStatus("EXECUTED")).toBe(true);
    expect(isTerminalChangeStatus("QUEUED")).toBe(false);
  });
});
