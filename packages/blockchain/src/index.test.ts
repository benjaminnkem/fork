import { describe, expect, it } from "vitest";
import { isSupportedChainId } from "./index.js";

describe("blockchain chain policy", () => {
  it("accepts only Base and Ethereum", () => {
    expect(isSupportedChainId(8453)).toBe(true);
    expect(isSupportedChainId(1)).toBe(true);
    expect(isSupportedChainId(84532)).toBe(false);
  });
});
