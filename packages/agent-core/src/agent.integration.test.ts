import { describe, expect, it } from "vitest";
import { loadConfig, loadRootEnv } from "@fork/config";
import { PINNED_ADD_COLLATERAL_WALLET } from "@fork/protocol-moonwell";
import { GroqModelProvider } from "./groq.js";
import { runAgent } from "./loop.js";
import { createAgentSession } from "./session.js";

loadRootEnv();
const config = loadConfig();
const live = Boolean(
  config.GROQ_API_KEY &&
    config.BASE_RPC_URL &&
    config.ETHEREUM_RPC_URL &&
    process.env.RUN_AGENT === "1",
);

describe.skipIf(!live)("live Groq agent", () => {
  it(
    "selects allowlisted tools over the real Moonwell pipeline",
    { timeout: 480_000 },
    async () => {
      const result = await runAgent({
        provider: GroqModelProvider.fromApiKey(config.GROQ_API_KEY!),
        session: createAgentSession({
          config,
          wallet: PINNED_ADD_COLLATERAL_WALLET,
        }),
        config,
        request: {
          wallet: PINNED_ADD_COLLATERAL_WALLET,
          scenario: "moonwell-176",
          prompt:
            "Use tools to read this wallet, inspect proposal 176, measure exposure, and report Comptroller risk. Do not invent numbers. Recommend a rescue only if a tool verified one.",
        },
      });
      expect(result.toolNames.length).toBeGreaterThan(0);
      expect(result.toolNames.every((name) => name !== "send_transaction")).toBe(true);
      if (result.status === "FAILED") {
        expect(result.userSummary).toBeNull();
        expect(result.reasons.length).toBeGreaterThan(0);
        return;
      }
      expect(result.status).toBe("COMPLETED");
      expect(result.userSummary).toBeTruthy();
      expect(result.userSummary).not.toMatch(/<think>/i);
      expect(
        result.toolNames.some((name) =>
          [
            "get_wallet_positions",
            "get_change_details",
            "get_exposure",
            "run_impact_simulation",
            "list_available_rescue_assets",
          ].includes(name),
        ),
      ).toBe(true);
    },
  );
});
