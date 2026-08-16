import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { canonicalizeJson, createForkClients, getBlockAnchor, requireChainClient, toJsonSafe } from "@fork/blockchain";
import type { AppConfig } from "@fork/config";
import { type PersistenceModels } from "@fork/persistence";
import {
  buildLiveAllowlistedPlan,
  executePlanCalls,
  JsonFileGovernanceStore,
  matchMoonwellExposure,
} from "@fork/protocol-moonwell";
import { createUserRiskPolicy } from "@fork/risk-engine";
import { startAnvilFork, stopAnvil } from "@fork/simulation-core";
import {
  BASE_CHAIN_ID,
  ForkError,
  type Address,
  type StrategyType,
} from "@fork/shared";
import { keccak256, stringToBytes } from "viem";
import { resolve } from "node:path";
import { APP_CONFIG } from "../config.token.js";
import { PERSISTENCE } from "../persistence.token.js";
import { SimulationsService } from "../simulations/simulations.service.js";
import { assertAllowlistedPlan, type DecodedPlannedCall } from "./allowlist.js";
import { classifyExecutionState } from "./verify-state.js";

export type ExecutionStatus =
  | "PREPARED"
  | "SUBMITTED"
  | "VERIFIED"
  | "PARTIAL"
  | "MISMATCH"
  | "FAILED"
  | "EXPIRED";

export interface ExecutionRecord {
  id: string;
  wallet: string;
  planHash: string;
  simulationRunId: string;
  strategyType: StrategyType;
  plan: unknown;
  decodedCalls: DecodedPlannedCall[];
  txHashes: string[];
  callReceipts: unknown[];
  expectedState: unknown;
  actualState: unknown;
  status: ExecutionStatus;
  expiresAt?: string;
  errorCode?: string;
  dryRun?: unknown;
}

@Injectable()
export class ExecutionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PERSISTENCE) private readonly models: PersistenceModels | null,
    @Inject(SimulationsService) private readonly simulations: SimulationsService,
  ) {}

  private requireModels(): PersistenceModels {
    if (!this.models) {
      throw new ForkError("INVALID_CONFIG", "MongoDB is required for execution plans");
    }
    return this.models;
  }

  async prepare(input: {
    wallet: Address;
    simulationId: string;
    strategyType: StrategyType;
  }): Promise<ExecutionRecord> {
    if (this.config.ENABLE_AUTONOMOUS_MAINNET_EXECUTION) {
      throw new ForkError(
        "INVALID_CONFIG",
        "ENABLE_AUTONOMOUS_MAINNET_EXECUTION must remain false",
      );
    }
    if (!this.config.ENABLE_MAINNET_TRANSACTION_PREPARATION) {
      throw new ForbiddenException({
        code: "NOT_IMPLEMENTED",
        message: "Mainnet transaction preparation is disabled",
      });
    }
    if (!this.config.BASE_RPC_URL) {
      throw new ForkError("INVALID_CONFIG", "BASE_RPC_URL is required to prepare execution");
    }
    const models = this.requireModels();
    const run = await this.simulations.getRun(input.simulationId);
    if (run.wallet.toLowerCase() !== input.wallet.toLowerCase()) {
      throw new ForbiddenException({
        code: "UNAUTHORIZED",
        message: "Simulation belongs to a different wallet",
      });
    }
    if (run.status !== "COMPLETED" || !run.receiptHash) {
      throw new ForkError("SIMULATION_STALE", "A completed proof is required before execution");
    }
    const completedAt = run.completedAt ? new Date(run.completedAt).getTime() : 0;
    if (!completedAt || Date.now() - completedAt > this.config.SIMULATION_MAX_AGE_SECONDS * 1000) {
      throw new ForkError("SIMULATION_STALE", "Simulation is older than SIMULATION_MAX_AGE_SECONDS");
    }

    const store = new JsonFileGovernanceStore(resolve(process.cwd(), ".data/governance-store.json"));
    const indexed = await store.getIndexedChange(run.protocolChangeId);
    if (!indexed) {
      throw new ForkError("GOVERNANCE_STATE_UNCERTAIN", "Indexed change is missing");
    }
    if (indexed.change.status === "CANCELLED" || indexed.change.status === "EXPIRED") {
      throw new ForkError("CHANGE_CANCELLED", `Change is ${indexed.change.status}`);
    }

    const strategies = await this.simulations.getStrategies(run.id);
    const payload = (strategies.strategies ?? {}) as {
      repay?: { status?: string; amountRaw?: string | null };
      addCollateral?: { status?: string; amountRaw?: string | null };
    };
    const branch = input.strategyType === "REPAY_DEBT" ? payload.repay : payload.addCollateral;
    const status = typeof branch === "object" ? branch?.status : typeof branch === "string" ? branch : undefined;
    if (status !== "VERIFIED") {
      throw new ForkError(
        "STRATEGY_POLICY_REJECTED",
        `${input.strategyType} was not VERIFIED on the proof`,
      );
    }
    const preferred =
      typeof branch === "object" && branch.amountRaw && /^\d+$/.test(branch.amountRaw)
        ? BigInt(branch.amountRaw)
        : undefined;

    const policyDoc = (await models.walletRiskPolicies
      .findOne({ wallet: input.wallet.toLowerCase(), active: true })
      .lean()) as Record<string, unknown> | null;
    const policy = createUserRiskPolicy({
      minSafetyBufferBps:
        typeof policyDoc?.minSafetyBufferBps === "number"
          ? policyDoc.minSafetyBufferBps
          : this.config.DEFAULT_MIN_SAFETY_BUFFER_BPS,
      envMinSafetyBufferBps: this.config.DEFAULT_MIN_SAFETY_BUFFER_BPS,
      allowRepayDebt: policyDoc?.allowRepayDebt === false ? false : true,
      allowAddCollateral: policyDoc?.allowAddCollateral === false ? false : true,
      optimizationGoal:
        policyDoc?.optimizationGoal === "MAX_SAFETY" || policyDoc?.optimizationGoal === "MIN_TX_COUNT"
          ? policyDoc.optimizationGoal
          : "MIN_CAPITAL",
    });

    const clients = createForkClients(this.config);
    const base = requireChainClient(clients, BASE_CHAIN_ID);
    const live = await buildLiveAllowlistedPlan({
      forkClient: base,
      wallet: input.wallet,
      strategyType: input.strategyType,
      policy,
      preferredAmountRaw: preferred,
    });
    const exposure = await matchMoonwellExposure(live.positions, indexed.change);
    if (!exposure.relevant) {
      throw new ForkError("NO_RELEVANT_EXPOSURE", "Live wallet is no longer exposed to this change");
    }
    const decodedCalls = assertAllowlistedPlan(live.plan);
    const dryRun = await this.dryRun(live.plan, input.wallet);
    if (!dryRun.ok) {
      throw new ForkError("CHANGE_REPLAY_REVERTED", dryRun.reason ?? "Live-head dry-run reverted");
    }

    const planJson = toJsonSafe({
      ...live.plan,
      amountRaw: live.plan.amountRaw.toString(),
      calls: decodedCalls,
    });
    const planHash = keccak256(stringToBytes(canonicalizeJson(planJson)));
    const expiresAt = new Date(Date.now() + this.config.SIMULATION_MAX_AGE_SECONDS * 1000);
    const created = await models.executionAttempts.create({
      wallet: input.wallet.toLowerCase(),
      planHash,
      simulationRunId: run.id,
      strategyType: input.strategyType,
      plan: planJson,
      txHashes: [],
      callReceipts: [],
      expectedState: live.plan.expectedState,
      actualState: { before: toJsonSafe(live.risk) },
      status: "PREPARED",
      expiresAt,
      dryRun,
    });
    return this.toRecord(created.toObject() as Record<string, unknown>, decodedCalls);
  }

  async get(id: string, wallet: Address): Promise<ExecutionRecord> {
    const models = this.requireModels();
    const doc = (await models.executionAttempts.findById(id).lean()) as Record<string, unknown> | null;
    if (!doc) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Execution plan not found" });
    }
    if (String(doc.wallet).toLowerCase() !== wallet.toLowerCase()) {
      throw new ForbiddenException({
        code: "UNAUTHORIZED",
        message: "Execution plan belongs to a different wallet",
      });
    }
    return this.toRecord(doc);
  }

  async registerTx(input: {
    id: string;
    wallet: Address;
    txHash: `0x${string}`;
    callIndex: number;
  }): Promise<ExecutionRecord> {
    const models = this.requireModels();
    const current = await this.get(input.id, input.wallet);
    if (current.status === "EXPIRED" || (current.expiresAt && Date.parse(current.expiresAt) <= Date.now())) {
      throw new ForkError("SIMULATION_STALE", "Execution plan expired");
    }
    if (current.status === "VERIFIED" || current.status === "MISMATCH" || current.status === "FAILED") {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Execution is already finalized");
    }
    const calls = current.decodedCalls;
    if (input.callIndex < 0 || input.callIndex >= calls.length) {
      throw new ForkError("INVALID_CONFIG", "callIndex is outside the prepared plan");
    }
    if (current.txHashes[input.callIndex]) {
      if (current.txHashes[input.callIndex]!.toLowerCase() !== input.txHash.toLowerCase()) {
        throw new ForkError("MAINNET_STATE_MISMATCH", "A different hash is already registered for this call");
      }
      return current;
    }
    if (input.callIndex !== current.txHashes.filter(Boolean).length) {
      throw new ForkError("INVALID_CONFIG", "Calls must be registered in order");
    }

    const clients = createForkClients(this.config);
    const base = requireChainClient(clients, BASE_CHAIN_ID);
    const receipt = await base.client.waitForTransactionReceipt({ hash: input.txHash });
    const callReceipts = Array.isArray(current.callReceipts) ? [...current.callReceipts] : [];
    callReceipts[input.callIndex] = {
      txHash: input.txHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      blockHash: receipt.blockHash,
    };
    const txHashes = [...current.txHashes];
    txHashes[input.callIndex] = input.txHash;
    const reverted = receipt.status !== "success";
    const confirmed = callReceipts.filter(
      (item) => item && typeof item === "object" && (item as { status?: string }).status === "success",
    ).length;
    let status: ExecutionStatus = reverted ? "FAILED" : "SUBMITTED";
    let actualState = current.actualState;

    if (!reverted && confirmed === calls.length) {
      const before = (current.actualState as { before?: { status?: string; liquidityRaw?: string; shortfallRaw?: string } })
        ?.before;
      const adapterRisk = await this.simulations.listRisk(input.wallet);
      const after = (adapterRisk as { risk: { status: string; liquidityRaw: string; shortfallRaw: string } }).risk;
      const classification = classifyExecutionState({
        expected: current.expectedState as { maxShortfallRaw: string; minSafetyBufferBps: number },
        before: {
          status: (before?.status as "SAFE") ?? "UNKNOWN",
          liquidityRaw: BigInt(before?.liquidityRaw ?? "0"),
          shortfallRaw: BigInt(before?.shortfallRaw ?? "0"),
        },
        after: {
          status: after.status as "SAFE",
          liquidityRaw: BigInt(after.liquidityRaw),
          shortfallRaw: BigInt(after.shortfallRaw),
        },
        submittedCalls: calls.length,
        confirmedCalls: confirmed,
        reverted,
      });
      status = classification;
      actualState = { before, after: toJsonSafe(after), classification };
    }

    await models.executionAttempts.updateOne(
      { _id: input.id },
      {
        $set: {
          txHashes,
          callReceipts,
          status,
          actualState,
          errorCode: reverted ? "MAINNET_STATE_MISMATCH" : undefined,
        },
      },
    );
    return this.get(input.id, input.wallet);
  }

  private async dryRun(
    plan: Parameters<typeof executePlanCalls>[2],
    wallet: Address,
  ): Promise<{ ok: boolean; reason?: string; calls: unknown }> {
    const clients = createForkClients(this.config);
    const base = requireChainClient(clients, BASE_CHAIN_ID);
    const anchor = await getBlockAnchor(base, "safe");
    const anvil = await startAnvilFork({
      binary: this.config.ANVIL_BINARY,
      host: this.config.ANVIL_HOST,
      startPort: this.config.ANVIL_PORT_START,
      forkUrl: this.config.BASE_RPC_URL!,
      forkBlockNumber: anchor.blockNumber,
      expectedBlockHash: anchor.blockHash,
      startTimeoutMs: this.config.FORK_START_TIMEOUT_MS,
    });
    try {
      const executed = await executePlanCalls(anvil, wallet, plan);
      const ok = executed.calls.length === plan.calls.length && executed.calls.every((call) => call.success);
      return {
        ok,
        reason: executed.reasons[0],
        calls: toJsonSafe(executed.calls),
      };
    } finally {
      await stopAnvil(anvil);
    }
  }

  private toRecord(doc: Record<string, unknown>, decoded?: DecodedPlannedCall[]): ExecutionRecord {
    const plan = doc.plan;
    const decodedCalls =
      decoded ??
      (Array.isArray((plan as { calls?: DecodedPlannedCall[] })?.calls)
        ? ((plan as { calls: DecodedPlannedCall[] }).calls)
        : []);
    return {
      id: String(doc._id ?? doc.id),
      wallet: String(doc.wallet),
      planHash: String(doc.planHash),
      simulationRunId: String(doc.simulationRunId),
      strategyType: doc.strategyType as StrategyType,
      plan,
      decodedCalls,
      txHashes: Array.isArray(doc.txHashes) ? doc.txHashes.map(String) : [],
      callReceipts: Array.isArray(doc.callReceipts) ? doc.callReceipts : [],
      expectedState: doc.expectedState,
      actualState: doc.actualState,
      status: String(doc.status) as ExecutionStatus,
      expiresAt: doc.expiresAt ? new Date(String(doc.expiresAt)).toISOString() : undefined,
      errorCode: doc.errorCode ? String(doc.errorCode) : undefined,
      dryRun: doc.dryRun,
    };
  }
}
