import { describe, expect, it } from "vitest";
import type { PersistenceModels } from "./connect.js";
import { claimSimulationRun } from "./runs.js";

function duplicateError(): Error {
  return Object.assign(
    new Error(
      'E11000 duplicate key error collection: fork.simulationRuns index: simulation_runs_idempotency_unique dup key: { idempotencyKey: "same" }',
    ),
    { code: 11000 },
  );
}

function fakeModels() {
  let stored: Record<string, unknown> | undefined;
  let inserting = false;
  const models = {
    simulationRuns: {
      findOne: () => ({
        lean: async () => stored,
      }),
      create: async (run: Record<string, unknown>) => {
        if (stored || inserting) throw duplicateError();
        inserting = true;
        await Promise.resolve();
        stored = { _id: "run-1", ...run };
        inserting = false;
        return { toObject: () => stored };
      },
    },
  };
  return { models: models as unknown as PersistenceModels, getStored: () => stored };
}

const seed = {
  wallet: "0x0efc0653d4fc2218f27ba9bb5767c0c83af25ae6",
  protocolChangeId: "moonwell:eth:176",
  mode: "impact",
  status: "QUEUED",
  replayGrade: "DESTINATION_EFFECT_REPLAY",
  idempotencyKey: "same",
  engineVersion: "dev",
  policyVersion: "1",
  forkBlockNumber: "48025643",
  forkBlockHash: "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc",
};

describe("claimSimulationRun", () => {
  it("returns the existing row instead of throwing on a unique-index race", async () => {
    const { models } = fakeModels();
    const [first, second] = await Promise.all([
      claimSimulationRun(models, seed),
      claimSimulationRun(models, seed),
    ]);
    expect(first.id).toBe("run-1");
    expect(second.id).toBe("run-1");
    expect(first.idempotencyKey).toBe("same");
  });

  it("returns a row that already exists without inserting", async () => {
    const { models } = fakeModels();
    const created = await claimSimulationRun(models, seed);
    const again = await claimSimulationRun(models, seed);
    expect(again.id).toBe(created.id);
  });
});
