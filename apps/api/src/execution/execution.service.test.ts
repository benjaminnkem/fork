import { describe, expect, it } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { loadConfig } from "@fork/config";
import { ExecutionService } from "./execution.service.js";

describe("ExecutionService", () => {
  it("refuses to prepare when mainnet preparation is disabled", async () => {
    const service = new ExecutionService(
      loadConfig({
        NODE_ENV: "development",
        APP_ENV: "local",
        ENABLE_MAINNET_TRANSACTION_PREPARATION: "false",
      }),
      null,
      {} as never,
    );
    await expect(
      service.prepare({
        wallet: "0x494c7fdb753c15b69fea2293e1b76567ca94462d",
        simulationId: "missing",
        strategyType: "ADD_COLLATERAL",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
