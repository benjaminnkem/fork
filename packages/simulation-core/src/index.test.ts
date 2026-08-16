import { describe, expect, it } from "vitest";
import { ForkError } from "@fork/shared";
import { SIMULATION_RECEIPT_SCHEMA_VERSION, startSimulation } from "./index.js";

describe("simulation-core", () => {
  it("pins receipt schema version 1", () => {
    expect(SIMULATION_RECEIPT_SCHEMA_VERSION).toBe("1");
  });

  it("does not spawn Anvil in Phase 0", () => {
    expect(() => startSimulation()).toThrow(ForkError);
  });
});
