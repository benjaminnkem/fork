import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { getAddress, isAddress } from "viem";
import {
  createForkClients,
  requireChainClient,
  toJsonSafe,
} from "@fork/blockchain";
import type { AppConfig } from "@fork/config";
import { repoDataPath } from "@fork/config";
import {
  createEvent,
  findReceiptByHash,
  findRunById,
  findRunByIdempotencyKey,
  insertSimulationRun,
  requeueSimulationRun,
  type PersistenceModels,
  type SimulationRunRecord,
} from "@fork/persistence";
import {
  createMoonwellAdapter,
  JsonFileGovernanceStore,
  loadMoonwell176Manifest,
  matchMoonwellExposure,
  PINNED_BASE_CF_PROPOSAL_ID,
  PINNED_REPLAY_FORK_BLOCK,
  PINNED_REPLAY_FORK_HASH,
} from "@fork/protocol-moonwell";
import { createUserRiskPolicy } from "@fork/risk-engine";
import { simulationIdempotencyKey } from "@fork/simulation-core";
import {
  BASE_CHAIN_ID,
  IMPACT_QUEUE_MAX_INFLIGHT,
  IMPACT_SIMULATION_QUEUE,
  type Address,
  type ImpactSimulationJob,
} from "@fork/shared";
import { APP_CONFIG } from "../config.token.js";
import { IMPACT_QUEUE, PERSISTENCE } from "../persistence.token.js";

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  if (record.code === 11000) return true;
  return typeof record.message === "string" && record.message.includes("E11000");
}

@Injectable()
export class SimulationsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PERSISTENCE) private readonly models: PersistenceModels | null,
    @Inject(IMPACT_QUEUE) private readonly queue: Queue<ImpactSimulationJob> | null,
  ) {}

  requireInfra(): PersistenceModels {
    if (!this.models || !this.queue) {
      throw new ServiceUnavailableException({
        code: "INVALID_CONFIG",
        message: "MongoDB and Redis are required to create or stream simulations",
      });
    }
    return this.models;
  }

  parseWallet(address: string): Address {
    if (!isAddress(address)) {
      throw new BadRequestException({
        code: "INVALID_CONFIG",
        message: "Wallet must be a 20-byte hex address",
      });
    }
    return getAddress(address) as Address;
  }

  async createImpact(input: {
    wallet: string;
    changeId?: string;
    scenario?: string;
    includeStrategies?: boolean;
  }): Promise<SimulationRunRecord> {
    const models = this.requireInfra();
    const wallet = this.parseWallet(input.wallet);
    const changeId = input.changeId ?? `moonwell:eth:${PINNED_BASE_CF_PROPOSAL_ID}`;
    const scenario = input.scenario ?? "moonwell-176";
    const policy = createUserRiskPolicy();
    const idempotencyKey = simulationIdempotencyKey({
      wallet,
      changeId,
      forkBlockHash: PINNED_REPLAY_FORK_HASH,
      policyVersion: policy.policyVersion,
      engineVersion: this.config.APP_VERSION,
    });
    const job = {
      wallet,
      changeId,
      scenario,
      includeStrategies: Boolean(input.includeStrategies),
    };
    const existing = await findRunByIdempotencyKey(models, idempotencyKey);
    if (existing) {
      return this.resumeExistingRun(models, existing, job);
    }

    try {
      const queued = createEvent("SIMULATION_QUEUED");
      const run = await insertSimulationRun(models, {
        wallet,
        protocolChangeId: changeId,
        mode: "impact",
        status: "QUEUED",
        replayGrade: "DESTINATION_EFFECT_REPLAY",
        idempotencyKey,
        engineVersion: this.config.APP_VERSION,
        policyVersion: policy.policyVersion,
        forkBlockNumber: PINNED_REPLAY_FORK_BLOCK.toString(),
        forkBlockHash: PINNED_REPLAY_FORK_HASH,
        scenario,
        includeStrategies: job.includeStrategies,
        events: [queued],
      });
      await this.ensureQueued(run, {
        simulationRunId: run.id,
        ...job,
      });
      return run;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await findRunByIdempotencyKey(models, idempotencyKey);
      if (!raced) throw error;
      return this.resumeExistingRun(models, raced, job);
    }
  }

  private async resumeExistingRun(
    models: PersistenceModels,
    existing: SimulationRunRecord,
    job: {
      wallet: Address;
      changeId: string;
      scenario: string;
      includeStrategies: boolean;
    },
  ): Promise<SimulationRunRecord> {
    let run = existing;
    if (
      existing.status === "FAILED" ||
      existing.status === "STALE" ||
      existing.status === "CANCELLED"
    ) {
      run =
        (await requeueSimulationRun(models, existing.id, {
          includeStrategies: job.includeStrategies,
        })) ?? existing;
    }
    if (run.status !== "COMPLETED") {
      await this.ensureQueued(run, {
        simulationRunId: run.id,
        ...job,
      });
    }
    return run;
  }

  private async ensureQueued(run: SimulationRunRecord, payload: ImpactSimulationJob) {
    const queue = this.queue!;
    const counts = await queue.getJobCounts("waiting", "delayed", "active");
    const inflight = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
    if (inflight >= IMPACT_QUEUE_MAX_INFLIGHT) {
      throw new ServiceUnavailableException({
        code: "RATE_LIMITED",
        message: "Impact simulation queue is at capacity",
      });
    }
    const jobId = run.idempotencyKey.replaceAll(":", "-");
    const existingJob = await queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === "active" || state === "waiting" || state === "delayed") {
        return;
      }
      await existingJob.remove();
    }
    await queue.add(IMPACT_SIMULATION_QUEUE, payload, {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async getRun(id: string): Promise<SimulationRunRecord> {
    const models = this.requireInfra();
    const run = await findRunById(models, id);
    if (!run) throw new NotFoundException({ code: "NOT_FOUND", message: "Simulation not found" });
    return run;
  }

  async getProof(id: string) {
    const run = await this.getRun(id);
    if (!run.receiptHash) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Proof is not ready" });
    }
    const receipt = await findReceiptByHash(this.requireInfra(), run.receiptHash);
    if (!receipt) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Receipt is missing" });
    }
    return receipt;
  }

  async getStrategies(id: string) {
    const run = await this.getRun(id);
    const strategyEvents = run.events.filter(
      (event) =>
        event.type === "STRATEGY_BRANCH_RESULT" || event.type === "RECOMMENDATION_READY",
    );
    return {
      simulationId: run.id,
      status: run.status,
      strategies: strategyEvents.at(-1)?.data ?? null,
    };
  }

  async listPositions(address: string) {
    const wallet = this.parseWallet(address);
    const clients = createForkClients(this.config);
    const adapter = createMoonwellAdapter(requireChainClient(clients, BASE_CHAIN_ID));
    const positions = await adapter.getUserPositions(wallet);
    return toJsonSafe({ wallet, positions });
  }

  async listRisk(address: string) {
    const wallet = this.parseWallet(address);
    const clients = createForkClients(this.config);
    const adapter = createMoonwellAdapter(requireChainClient(clients, BASE_CHAIN_ID));
    const risk = await adapter.getRiskState(wallet);
    return toJsonSafe({ wallet, risk });
  }

  async relevantChanges(address: string) {
    const wallet = this.parseWallet(address);
    const clients = createForkClients(this.config);
    const adapter = createMoonwellAdapter(requireChainClient(clients, BASE_CHAIN_ID));
    const positions = await adapter.getUserPositions(wallet);
    const store = new JsonFileGovernanceStore(repoDataPath("governance-store.json"));
    const indexed = await store.listIndexedChanges();
    const matches = [];
    for (const record of indexed) {
      const exposure = await matchMoonwellExposure(positions, record.change);
      if (exposure.relevant) {
        matches.push({
          change: record.change,
          exposure,
          sourceStatus: record.sourceStatus,
          destinationStatus: record.destinationStatus,
          rawGovernorState: record.rawGovernorState,
        });
      }
    }
    return toJsonSafe({ wallet, matches });
  }

  async listChanges() {
    const store = new JsonFileGovernanceStore(repoDataPath("governance-store.json"));
    return toJsonSafe({ changes: await store.listIndexedChanges() });
  }

  async getChange(id: string) {
    const store = new JsonFileGovernanceStore(repoDataPath("governance-store.json"));
    const record = await store.getIndexedChange(id);
    if (!record) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Change not found" });
    }
    return toJsonSafe(record);
  }

  historicalReplays() {
    const manifest = loadMoonwell176Manifest();
    return [
      {
        slug: manifest.slug,
        proposalId: manifest.proposalId,
        changeId: manifest.changeId,
        forkBlockNumber: manifest.fork.blockNumber,
        forkBlockHash: manifest.fork.blockHash,
        replayGrade: manifest.replayGrade,
        wallet: manifest.wallets.historical.address,
        market: manifest.contracts.market,
        recomputed: true,
      },
    ];
  }
}
