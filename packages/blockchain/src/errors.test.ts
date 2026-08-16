import { describe, expect, it } from "vitest";
import { classifyRpcError } from "./errors.js";

describe("classifyRpcError", () => {
  it("treats 429 as retryable rate limiting", () => {
    const classified = classifyRpcError({ status: 429, message: "Too Many Requests" });
    expect(classified).toMatchObject({ class: "RATE_LIMIT", retryable: true, code: "RPC_RATE_LIMITED" });
  });

  it("fails closed on missing historical state", () => {
    const classified = classifyRpcError(new Error("missing trie node"));
    expect(classified.retryable).toBe(false);
    expect(classified.code).toBe("RPC_ARCHIVE_UNAVAILABLE");
  });

  it("retries timeouts", () => {
    const classified = classifyRpcError(new Error("request timeout"));
    expect(classified.retryable).toBe(true);
    expect(classified.code).toBe("RPC_UNAVAILABLE");
  });
});
