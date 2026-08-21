import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@fork/config";
import type { PersistenceModels, SimulationRunRecord } from "@fork/persistence";
import { PINNED_SHORTFALL_WALLET } from "@fork/protocol-moonwell";
import { SimulationsService } from "./simulations.service.js";

function duplicateError(): Error {
  return Object.assign(
    new Error(
      'E11000 duplicate key error collection: fork.simulationRuns index: simulation_runs_idempotency_unique dup key: { idempotencyKey: "x" }',
    ),
    { code: 11000 },
  );
}

function fakeQueue() {
  return {
    getJobCounts: vi.fn(async () => ({ waiting: 0, delayed: 0, active: 0 })),
    getJob: vi.fn(async () => null),
    add: vi.fn(async () => ({ id: "job" })),
  };
}

function fakeModels(initial?: Record<string, unknown>) {
  let stored: Record<string, unknown> | undefined = initial;
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
        stored = { _id: stored?._id ?? "run-1", ...run };
        inserting = false;
        return { toObject: () => stored };
      },
      findByIdAndUpdate: (_id: string, update: { $set?: Record<string, unknown> }) => ({
        lean: async () => {
          if (!stored) return undefined;
          stored = {
            ...stored,
            ...(update.$set ?? {}),
            status: update.$set?.status ?? stored.status,
          };
          return stored;
        },
      }),
    },
  };
  return { models: models as unknown as PersistenceModels, getStored: () => stored };
}

describe("SimulationsService.createImpact", () => {
  const config = { APP_VERSION: "dev" } as AppConfig;

  it("does not surface E11000 when two creates race", async () => {
    const { models } = fakeModels();
    const queue = fakeQueue();
    const service = new SimulationsService(config, models, queue as never);
    const input = { wallet: PINNED_SHORTFALL_WALLET, includeStrategies: true };
    const [first, second] = await Promise.all([
      service.createImpact(input),
      service.createImpact(input),
    ]);
    expect(first.id).toBe(second.id);
    expect(first.status).toBe("QUEUED");
    expect(queue.add).toHaveBeenCalled();
  });

  it("requeues a failed run instead of inserting a duplicate", async () => {
    const failed: Record<string, unknown> = {
      _id: "run-failed",
      wallet: PINNED_SHORTFALL_WALLET.toLowerCase(),
      protocolChangeId: "moonwell:eth:176",
      mode: "impact",
      status: "FAILED",
      replayGrade: "DESTINATION_EFFECT_REPLAY",
      idempotencyKey: "existing",
      engineVersion: "dev",
      policyVersion: "1",
      forkBlockNumber: "1",
      forkBlockHash: "0x1",
      events: [],
    };
    const { models, getStored } = fakeModels(failed);
    const queue = fakeQueue();
    const service = new SimulationsService(config, models, queue as never);
    const run = await service.createImpact({
      wallet: PINNED_SHORTFALL_WALLET,
      includeStrategies: true,
    });
    expect(run.id).toBe("run-failed");
    expect(getStored()?.status).toBe("QUEUED");
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it("returns a completed run without throwing", async () => {
    const completed: Partial<SimulationRunRecord> & Record<string, unknown> = {
      _id: "run-done",
      wallet: PINNED_SHORTFALL_WALLET.toLowerCase(),
      protocolChangeId: "moonwell:eth:176",
      mode: "impact",
      status: "COMPLETED",
      replayGrade: "DESTINATION_EFFECT_REPLAY",
      idempotencyKey: "existing",
      engineVersion: "dev",
      policyVersion: "1",
      forkBlockNumber: "1",
      forkBlockHash: "0x1",
      events: [],
    };
    const { models } = fakeModels(completed);
    const queue = fakeQueue();
    const service = new SimulationsService(config, models, queue as never);
    const run = await service.createImpact({ wallet: PINNED_SHORTFALL_WALLET });
    expect(run.id).toBe("run-done");
    expect(run.status).toBe("COMPLETED");
    expect(queue.add).not.toHaveBeenCalled();
  });
});
