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
import { ETHEREUM_CHAIN_ID, ForkError, type ImpactSimulationJob } from "@fork/shared";

export async function processImpactSimulation(
  models: PersistenceModels,
  config: AppConfig,
  job: ImpactSimulationJob,
): Promise<void> {
  const run = await findRunById(models, job.simulationRunId);
  if (!run) {
    throw new ForkError("SIMULATION_STALE", `Unknown simulation run ${job.simulationRunId}`);
  }
  if (run.status === "COMPLETED" || run.status === "FAILED") {
    return;
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
