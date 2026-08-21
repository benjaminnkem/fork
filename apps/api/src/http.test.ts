import { describe, expect, it } from "vitest";
import { BadRequestException, ServiceUnavailableException, type ArgumentsHost } from "@nestjs/common";
import { z } from "zod";
import { ForkExceptionFilter, MemoryRateLimiter, parseWithZod } from "./http.js";

describe("api validation and rate limits", () => {
  it("rejects invalid bodies", () => {
    expect(() => parseWithZod(z.object({ wallet: z.string().min(5) }), {})).toThrow(
      BadRequestException,
    );
  });

  it("enforces the public simulation rate limit", () => {
    const limiter = new MemoryRateLimiter(60_000, 2);
    limiter.consume("ip");
    limiter.consume("ip");
    expect(() => limiter.consume("ip")).toThrow(ServiceUnavailableException);
  });

  it("does not leak Mongo duplicate-key internals", () => {
    const store: { status?: number; body?: unknown } = {};
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status(code: number) {
            store.status = code;
            return this;
          },
          json(body: unknown) {
            store.body = body;
            return this;
          },
        }),
      }),
    } as unknown as ArgumentsHost;
    const filter = new ForkExceptionFilter();
    filter.catch(
      Object.assign(
        new Error(
          'E11000 duplicate key error collection: fork.simulationRuns index: simulation_runs_idempotency_unique dup key: { idempotencyKey: "x" }',
        ),
        { code: 11000 },
      ),
      host,
    );
    expect(store.status).toBe(409);
    expect(JSON.stringify(store.body)).not.toMatch(/E11000|idempotencyKey|dup key/i);
    expect(store.body).toMatchObject({
      message: "A simulation for this wallet and change already exists",
    });
  });
});
