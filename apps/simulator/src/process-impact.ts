import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import type { AppConfig } from "@fork/config";
import {
  appendRunEvent,
  createEvent,
  findRunById,
  saveReceipt,
  type PersistenceModels,
} from "@fork/persistence";
import {
  comparePinnedStrategies,
  replayPinnedCollateralFactor,
} from "@fork/protocol-moonwell";
import { hashReceipt } from "@fork/simulation-core";
import { getAddress, isAddress } from "viem";
import { ETHEREUM_CHAIN_ID, ForkError, type ImpactSimulationJob } from "@fork/shared";

export function parseImpactSimulationJob(value: unknown): ImpactSimulationJob {
  if (!value || typeof value !== "object") {
    throw new ForkError("INVALID_CONFIG", "Impact job payload is not an object");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.simulationRunId !== "string" || record.simulationRunId.length < 8) {
    throw new ForkError("INVALID_CONFIG", "Impact job simulationRunId is invalid");
  }
  if (typeof record.wallet !== "string" || !isAddress(record.wallet)) {
    throw new ForkError("INVALID_CONFIG", "Impact job wallet is invalid");
  }
  if (typeof record.changeId !== "string" || !record.changeId.startsWith("moonwell:")) {
    throw new ForkError("INVALID_CONFIG", "Impact job changeId is not a Moonwell change");
  }
  if (record.scenario !== undefined && record.scenario !== "moonwell-176") {
    throw new ForkError("UNSUPPORTED_PROTOCOL_CHANGE", "Only moonwell-176 impact jobs are supported");
  }
  return {
    simulationRunId: record.simulationRunId,
    wallet: getAddress(record.wallet),
    changeId: record.changeId,
    scenario: typeof record.scenario === "string" ? record.scenario : "moonwell-176",
    includeStrategies: Boolean(record.includeStrategies),
  };
}

export async function processImpactSimulation(
  models: PersistenceModels,
  config: AppConfig,
  job: ImpactSimulationJob,
): Promise<void> {
  const run = await findRunById(models, job.simulationRunId);
  if (!run) {
    throw new ForkError("SIMULATION_STALE", `Unknown simulation run ${job.simulationRunId}`);
  }
  if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELLED" || run.status === "STALE") {
    return;
  }
  if (run.wallet.toLowerCase() !== job.wallet.toLowerCase()) {
    throw new ForkError("SIMULATION_STALE", "Impact job wallet does not match the persisted run");
  }
  if (run.protocolChangeId !== job.changeId) {
    throw new ForkError("SIMULATION_STALE", "Impact job change does not match the persisted run");
  }

  await appendRunEvent(models, run.id, createEvent("FORK_STARTING"), {
    status: "RUNNING",
    startedAt: new Date(),
  });

  const clients = createForkClients(config);
  if (!config.BASE_RPC_URL) {
    throw new ForkError("INVALID_CONFIG", "BASE_RPC_URL is required for impact simulation");
  }

  try {
    await appendRunEvent(models, run.id, createEvent("CHANGE_REPLAY_STARTED"));
    const receipt = await replayPinnedCollateralFactor({
      ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
      baseRpcUrl: config.BASE_RPC_URL,
      wallet: job.wallet as `0x${string}`,
    });
    const receiptHash = hashReceipt(receipt);
    const body = toJsonSafe(receipt);
    await saveReceipt(models, {
      receiptHash,
      receiptSchemaVersion: receipt.receiptSchemaVersion,
      engineVersion: receipt.engineVersion,
      wallet: receipt.wallet,
      protocolChangeId: receipt.changeId,
      proposalId: receipt.proposalId,
      forkBlockNumber: receipt.fork.blockNumber.toString(),
      forkBlockHash: receipt.fork.blockHash,
      replayGrade: receipt.replayGrade,
      body,
    });
    await appendRunEvent(
      models,
      run.id,
      createEvent("CHANGE_REPLAY_COMPLETED", { receiptHash }),
    );
    await appendRunEvent(
      models,
      run.id,
      createEvent("RISK_MEASURED", {
        beforeStatus: receipt.before.risk.status,
        afterStatus: receipt.after.risk.status,
        liquidityDeltaRaw: receipt.liquidityDeltaRaw,
      }),
      {
        receiptHash,
        before: toJsonSafe(receipt.before),
        after: toJsonSafe(receipt.after),
        replayGrade: receipt.replayGrade,
      },
    );
    if (job.includeStrategies) {
      await appendRunEvent(models, run.id, createEvent("STRATEGY_OPTIMIZATION_STARTED"));
      const comparison = await comparePinnedStrategies({
        ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
        baseRpcUrl: config.BASE_RPC_URL,
        wallet: job.wallet as `0x${string}`,
      });
      const strategyBody = toJsonSafe({
        repay: {
          status: comparison.repay.status,
          amountRaw: comparison.repay.amountRaw,
          reasons: comparison.repay.reasons,
          plan: comparison.repay.plan,
        },
        addCollateral: {
          status: comparison.addCollateral.status,
          amountRaw: comparison.addCollateral.amountRaw,
          reasons: comparison.addCollateral.reasons,
          plan: comparison.addCollateral.plan,
        },
      }) as Record<string, unknown>;
      await appendRunEvent(
        models,
        run.id,
        createEvent("STRATEGY_BRANCH_RESULT", strategyBody),
      );
      await appendRunEvent(
        models,
        run.id,
        createEvent("RECOMMENDATION_READY", strategyBody),
      );
    }

    await appendRunEvent(models, run.id, createEvent("PROOF_READY", { receiptHash }), {
      status: "COMPLETED",
      completedAt: new Date(),
    });
  } catch (error) {
    const code = error instanceof ForkError ? error.code : "RISK_READ_FAILED";
    await appendRunEvent(models, run.id, createEvent("FAILED", { code }), {
      status: "FAILED",
      errorCode: code,
      completedAt: new Date(),
    });
    if (error instanceof ForkError && error.retryable) {
      throw error;
    }
  }
}
