import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createImpact, isRetryableImpactError } from "./api";

describe("createImpact client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("coalesces concurrent clicks into one POST", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response(JSON.stringify({ id: "run-1", status: "QUEUED" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const input = { wallet: "0x0EFC0653D4Fc2218f27ba9Bb5767C0c83aF25aE6" };
    const [first, second] = await Promise.all([createImpact(input), createImpact(input)]);
    expect(first.id).toBe("run-1");
    expect(second.id).toBe("run-1");
    expect(calls).toBe(1);
  });

  it("retries a duplicate-key failure and returns the existing run", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return new Response(
            JSON.stringify({
              code: "INTERNAL",
              message:
                'E11000 duplicate key error collection: fork.simulationRuns index: simulation_runs_idempotency_unique dup key: { idempotencyKey: "x" }',
            }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ id: "run-existing", status: "QUEUED" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const run = await createImpact({
      wallet: "0x494c7fdb753c15b69fea2293e1b76567ca94462d",
    });
    expect(run.id).toBe("run-existing");
    expect(calls).toBe(2);
  });

  it("treats duplicate-key API errors as retryable", () => {
    expect(
      isRetryableImpactError(
        new ApiError(
          500,
          "INTERNAL",
          'E11000 duplicate key error collection: fork.simulationRuns index: simulation_runs_idempotency_unique',
        ),
      ),
    ).toBe(true);
    expect(isRetryableImpactError(new ApiError(400, "INVALID_CONFIG", "bad wallet"))).toBe(false);
  });
});
