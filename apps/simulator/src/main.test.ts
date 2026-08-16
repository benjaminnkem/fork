import { describe, expect, it } from "vitest";
import { loadConfig } from "@fork/config";

describe("simulator skeleton", () => {
  it("defaults Anvil to localhost and a small fork cap", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.ANVIL_HOST).toBe("127.0.0.1");
    expect(config.MAX_PARALLEL_FORKS).toBeLessThanOrEqual(3);
  });
});
