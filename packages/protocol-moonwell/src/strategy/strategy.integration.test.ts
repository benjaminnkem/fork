import { describe, expect, it } from "vitest";
import { createForkClients } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { assertPositiveAmount } from "@fork/strategy-engine";
import {
  PINNED_ADD_COLLATERAL_WALLET,
  PINNED_REPAY_WALLET,
  PINNED_REPLAY_WALLET,
} from "../governance/pinned-fork.js";
import { comparePinnedStrategies, smokeRepayExecution } from "./run.js";
import { buildRepayPlan } from "./plans.js";
import { createUserRiskPolicy } from "@fork/risk-engine";

loadRootEnv();
const config = loadConfig();
const live = Boolean(config.BASE_RPC_URL && config.ETHEREUM_RPC_URL && process.env.RUN_FORK_REPLAY === "1");

describe("strategy amount rejection", () => {
  it("rejects invalid amounts before any fork work", () => {
    expect(() => assertPositiveAmount(0n, 10n)).toThrow();
    expect(() =>
      buildRepayPlan({
        wallet: PINNED_REPLAY_WALLET,
        market: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22",
        underlying: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amountRaw: 11n,
        boundRaw: 10n,
        allowanceRaw: 0n,
        collateralEnabled: true,
        policy: createUserRiskPolicy(),
      }),
    ).toThrow();
  });
});

describe.skipIf(!live)("proposal 176 strategy search", () => {
  it(
    "reports the impact wallet as lacking rescue assets",
    { timeout: 300_000 },
    async () => {
      const clients = createForkClients(config);
      const result = await comparePinnedStrategies({
        ethereum: clients.ethereum!,
        baseRpcUrl: config.BASE_RPC_URL!,
        wallet: PINNED_REPLAY_WALLET,
        maxProbes: 8,
      });
      expect(result.repay.status === "INFEASIBLE" || result.repay.status === "NOT_REQUIRED").toBe(
        true,
      );
      expect(
        result.addCollateral.status === "INFEASIBLE" ||
          result.addCollateral.status === "NOT_REQUIRED",
      ).toBe(true);
    },
  );

  it(
    "verifies ADD_COLLATERAL on the isolated wallet when a measured buffer is required",
    { timeout: 360_000 },
    async () => {
      const clients = createForkClients(config);
      const result = await comparePinnedStrategies({
        ethereum: clients.ethereum!,
        baseRpcUrl: config.BASE_RPC_URL!,
        wallet: PINNED_ADD_COLLATERAL_WALLET,
        maxProbes: 40,
        raiseBufferToForceSearch: true,
      });
      expect(result.repay.status).toBe("INFEASIBLE");
      expect(result.addCollateral.status).toBe("VERIFIED");
      expect(result.addCollateral.amountRaw).not.toBeNull();
      expect(BigInt(result.addCollateral.amountRaw!)).toBeGreaterThan(0n);
      expect(result.addCollateral.plan?.strategyType).toBe("ADD_COLLATERAL");
      expect(result.addCollateral.plan?.underlying.toLowerCase()).toBe(
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      );
    },
  );

  it(
    "repays real EURC debt from the wallet's own balance",
    { timeout: 300_000 },
    async () => {
      const clients = createForkClients(config);
      const smoke = await smokeRepayExecution({
        ethereum: clients.ethereum!,
        baseRpcUrl: config.BASE_RPC_URL!,
        wallet: PINNED_REPAY_WALLET,
      });
      expect(smoke.feasible).toBe(true);
      expect(smoke.success).toBe(true);
      expect(BigInt(smoke.borrowAfter!)).toBeLessThan(BigInt(smoke.borrowBefore!));
    },
  );
});
