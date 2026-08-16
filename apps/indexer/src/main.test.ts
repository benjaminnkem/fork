import { describe, expect, it } from "vitest";
import { loadConfig } from "@fork/config";

describe("indexer skeleton", () => {
  it("uses a 30-60s class poll interval by default", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.GOVERNANCE_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(30_000);
    expect(config.GOVERNANCE_POLL_INTERVAL_MS).toBeLessThanOrEqual(60_000);
  });
});
