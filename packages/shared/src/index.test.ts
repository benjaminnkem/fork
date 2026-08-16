import { describe, expect, it } from "vitest";
import { BASE_CHAIN_ID, ETHEREUM_CHAIN_ID, ForkError } from "./index.js";

describe("shared domain constants", () => {
  it("locks V1 chain IDs", () => {
    expect(BASE_CHAIN_ID).toBe(8453);
    expect(ETHEREUM_CHAIN_ID).toBe(1);
  });

  it("marks config errors as non-retryable by default", () => {
    const error = new ForkError("INVALID_CONFIG", "missing BASE_RPC_URL");
    expect(error.retryable).toBe(false);
    expect(error.code).toBe("INVALID_CONFIG");
  });
});
