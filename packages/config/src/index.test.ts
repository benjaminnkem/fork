import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { ForkError } from "@fork/shared";
import { findRepoRoot, loadConfig, repoDataPath } from "./index.js";

describe("loadConfig", () => {
  it("loads local defaults without secrets", () => {
    const config = loadConfig({
      NODE_ENV: "development",
      APP_ENV: "local",
    });
    expect(config.API_PORT).toBe(4000);
    expect(config.BASE_CHAIN_ID).toBe(8453);
    expect(config.GROQ_PLANNER_MODEL).toBe("openai/gpt-oss-120b");
    expect(config.ENABLE_AUTONOMOUS_MAINNET_EXECUTION).toBe(false);
    expect(config.DEFAULT_MIN_SAFETY_BUFFER_BPS).toBeUndefined();
  });

  it("resolves the repo .data directory from a nested cwd", () => {
    const root = findRepoRoot();
    expect(existsSync(`${root}/pnpm-workspace.yaml`)).toBe(true);
    expect(repoDataPath("governance-store.json")).toContain("/.data/governance-store.json");
  });

  it("fails closed in production when RPC URLs are missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        APP_ENV: "production",
        SESSION_SECRET: "x".repeat(32),
        MONGODB_URI: "mongodb://localhost:27017/fork",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow(ForkError);
  });
});
