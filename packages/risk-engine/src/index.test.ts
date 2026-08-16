import { describe, expect, it } from "vitest";
import { classifyRisk } from "./index.js";

describe("risk-engine", () => {
  it("classifies shortfall from canonical integers", () => {
    expect(classifyRisk(0n, 1n)).toBe("SHORTFALL");
    expect(classifyRisk(10n, 0n)).toBe("SAFE");
  });
});
