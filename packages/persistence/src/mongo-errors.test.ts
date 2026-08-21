import { describe, expect, it } from "vitest";
import { isDuplicateJobError, isDuplicateKeyError } from "./mongo-errors.js";

describe("isDuplicateKeyError", () => {
  it("detects driver, mongoose, and nested duplicate-key shapes", () => {
    expect(isDuplicateKeyError({ code: 11000, message: "E11000 duplicate key" })).toBe(true);
    expect(isDuplicateKeyError({ code: "11000" })).toBe(true);
    expect(isDuplicateKeyError({ codeName: "DuplicateKey" })).toBe(true);
    expect(
      isDuplicateKeyError({
        message: "write failed",
        cause: {
          code: 11000,
          message:
            'E11000 duplicate key error collection: fork.simulationRuns index: simulation_runs_idempotency_unique dup key: { idempotencyKey: "x" }',
        },
      }),
    ).toBe(true);
    expect(
      isDuplicateKeyError({
        writeErrors: [{ code: 11000, errmsg: "E11000 duplicate key" }],
      }),
    ).toBe(true);
    expect(isDuplicateKeyError(new Error("network down"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});

describe("isDuplicateJobError", () => {
  it("detects BullMQ job-id collisions", () => {
    expect(isDuplicateJobError(new Error("Job with id abc already exists"))).toBe(true);
    expect(isDuplicateJobError(new Error("Job is already in queue"))).toBe(true);
    expect(isDuplicateJobError(new Error("redis timeout"))).toBe(false);
  });
});
