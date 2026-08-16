import { describe, expect, it } from "vitest";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import { MemoryRateLimiter, parseWithZod } from "./http.js";

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
});
