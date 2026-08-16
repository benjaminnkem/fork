import { describe, expect, it } from "vitest";
import { V1_STRATEGY_TYPES } from "./index.js";

describe("strategy-engine", () => {
  it("locks V1 to repay and add collateral", () => {
    expect(V1_STRATEGY_TYPES).toEqual(["REPAY_DEBT", "ADD_COLLATERAL"]);
  });
});
