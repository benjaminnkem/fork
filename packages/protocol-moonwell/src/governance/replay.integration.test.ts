import { describe, expect, it } from "vitest";
import { createForkClients } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { replayPinnedCollateralFactor } from "./replay.js";

loadRootEnv();
const config = loadConfig();
const live = Boolean(config.BASE_RPC_URL && config.ETHEREUM_RPC_URL && process.env.RUN_FORK_REPLAY === "1");

describe.skipIf(!live)("proposal 176 Anvil replay", () => {
  it(
    "applies the exact CF calldata and measures a real liquidity change",
    { timeout: 240_000 },
    async () => {
      const clients = createForkClients(config);
      const receipt = await replayPinnedCollateralFactor({
        ethereum: clients.ethereum!,
        baseRpcUrl: config.BASE_RPC_URL!,
      });
      expect(receipt.replayGrade).toBe("DESTINATION_EFFECT_REPLAY");
      expect(receipt.before.collateralFactorMantissa).toBe("680000000000000000");
      expect(receipt.after.collateralFactorMantissa).toBe("520000000000000000");
      expect(receipt.calls[0]?.success).toBe(true);
      expect(receipt.after.risk.liquidityRaw < receipt.before.risk.liquidityRaw).toBe(true);
      expect(receipt.after.risk.shortfallRaw >= receipt.before.risk.shortfallRaw).toBe(true);
    },
  );
});
