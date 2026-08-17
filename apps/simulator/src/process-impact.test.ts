import { describe, expect, it } from "vitest";
import { ForkError } from "@fork/shared";
import { parseImpactSimulationJob } from "./process-impact.js";

describe("parseImpactSimulationJob", () => {
  it("accepts a bounded moonwell-176 payload", () => {
    const job = parseImpactSimulationJob({
      simulationRunId: "64b1f0c2a1b2c3d4e5f60708",
      wallet: "0x494c7fdb753c15b69fea2293e1b76567ca94462d",
      changeId: "moonwell:eth:176",
      scenario: "moonwell-176",
      includeStrategies: true,
    });
    expect(job.wallet).toMatch(/^0x/);
    expect(job.scenario).toBe("moonwell-176");
  });

  it("rejects arbitrary change ids and wallets", () => {
    expect(() =>
      parseImpactSimulationJob({
        simulationRunId: "64b1f0c2a1b2c3d4e5f60708",
        wallet: "not-an-address",
        changeId: "moonwell:eth:176",
        scenario: "moonwell-176",
      }),
    ).toThrow(ForkError);
    expect(() =>
      parseImpactSimulationJob({
        simulationRunId: "64b1f0c2a1b2c3d4e5f60708",
        wallet: "0x494c7fdb753c15b69fea2293e1b76567ca94462d",
        changeId: "aave:eth:1",
        scenario: "moonwell-176",
      }),
    ).toThrow(ForkError);
  });
});
