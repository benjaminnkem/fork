import { resolve } from "node:path";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { createForkClients, getBlockAnchor, requireChainClient } from "@fork/blockchain";
import type { AppConfig } from "@fork/config";
import {
  connectMongo,
  createPersistenceModels,
  ensureMongoIndexes,
  type PersistenceModels,
} from "@fork/persistence";
import {
  createMoonwellAdapter,
  JsonFileGovernanceStore,
  matchMoonwellExposure,
  refreshDestinationStatuses,
  refreshIndexedChangeStatuses,
  syncMoonwellGovernor,
} from "@fork/protocol-moonwell";
import {
  indexLagBlocks,
  shouldEnqueueImpact,
  shouldRefreshSimulations,
  type GovernanceStore,
  type NormalizedIndexedChange,
} from "@fork/governance-core";
import {
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  IMPACT_SIMULATION_QUEUE,
  type ImpactSimulationJob,
} from "@fork/shared";
import { enqueuePinnedImpact } from "./enqueue.js";
import { writeMetrics, type MonitoringMetrics } from "./metrics.js";
import { markOpenRunsForChange } from "./stale.js";

export interface MonitorTickResult {
  metrics: MonitoringMetrics;
  transitions: Array<{ changeId: string; from: string; to: string }>;
}

export async function runMonitorTick(input: {
  config: AppConfig;
  store: GovernanceStore;
  models?: PersistenceModels | null;
  queue?: Queue<ImpactSimulationJob> | null;
  metricsPath?: string;
}): Promise<MonitorTickResult> {
  const clients = createForkClients(input.config);
  const previous = new Map(
    (await input.store.listIndexedChanges()).map((record) => [record.change.id, record.change.status]),
  );
  const ethereum = requireChainClient(clients, ETHEREUM_CHAIN_ID);
  const sync = await syncMoonwellGovernor({
    ethereum,
    base: clients.base,
    store: input.store,
  });
  const refreshed = await refreshIndexedChangeStatuses({
    ethereum,
    store: input.store,
  });
  const destination = clients.base
    ? await refreshDestinationStatuses({ base: clients.base, store: input.store })
    : undefined;

  const nextRecords = await input.store.listIndexedChanges();
  const transitions: Array<{ changeId: string; from: string; to: string }> = [];
  let staleMarked = 0;
  let enqueued = 0;
  let monitoredWallets = 0;

  for (const record of nextRecords) {
    const from = previous.get(record.change.id);
    if (from && from !== record.change.status) {
      transitions.push({ changeId: record.change.id, from, to: record.change.status });
      if (input.models && shouldRefreshSimulations(from, record.change.status)) {
        staleMarked += await markOpenRunsForChange(input.models, record.change.id, record.change.status);
      }
    }
  }

  if (input.models && (sync.reorgDetected || destination?.reorgDetected)) {
    for (const record of nextRecords) {
      staleMarked += await markOpenRunsForChange(input.models, record.change.id, record.change.status);
    }
  }

  if (input.models && input.queue && clients.base) {
    const wallets = (await input.models.wallets
      .find({ monitoringEnabled: true })
      .lean()) as Array<{ address?: string }>;
    monitoredWallets = wallets.length;
    const adapter = createMoonwellAdapter(requireChainClient(clients, BASE_CHAIN_ID));
    for (const walletDoc of wallets) {
      if (!walletDoc.address) continue;
      const positions = await adapter.getUserPositions(walletDoc.address as `0x${string}`);
      for (const record of nextRecords) {
        const exposure = matchMoonwellExposure(positions, record.change);
        const existing = (await input.models.exposures
          .findOne({
            wallet: walletDoc.address.toLowerCase(),
            protocolChangeId: record.change.id,
          })
          .lean()) as { relevant?: boolean } | null;
        await input.models.exposures.updateOne(
          { wallet: walletDoc.address.toLowerCase(), protocolChangeId: record.change.id },
          {
            $set: {
              wallet: walletDoc.address.toLowerCase(),
              protocolChangeId: record.change.id,
              relevant: exposure.relevant,
              severityHint: exposure.severityHint,
              matchedMarkets: exposure.matchedMarkets,
              matchedAssets: exposure.matchedAssets,
              rationaleCodes: exposure.rationaleCodes,
              evidence: exposure.evidence,
            },
          },
          { upsert: true },
        );
        const statusChanged = Boolean(
          previous.get(record.change.id) && previous.get(record.change.id) !== record.change.status,
        );
        if (
          shouldEnqueueImpact({
            monitoringEnabled: true,
            relevant: exposure.relevant,
            supportLevel: record.change.supportLevel,
            changeId: record.change.id,
            status: record.change.status,
            statusChanged,
            firstRelevant: !existing?.relevant && exposure.relevant,
          })
        ) {
          const result = await enqueuePinnedImpact({
            models: input.models,
            queue: input.queue,
            wallet: walletDoc.address,
            changeId: record.change.id,
            engineVersion: input.config.APP_VERSION,
          });
          if (result === "created") enqueued += 1;
        }
      }
    }
  }

  const ethSafe = await getBlockAnchor(ethereum, "safe");
  const baseSafe = clients.base ? await getBlockAnchor(clients.base, "safe") : undefined;
  const metrics: MonitoringMetrics = {
    lastTickAt: new Date().toISOString(),
    ethereum: {
      cursorBlock: sync.cursor.lastProcessedBlock.toString(),
      cursorHash: sync.cursor.lastProcessedBlockHash,
      safeBlock: ethSafe.blockNumber.toString(),
      lagBlocks: indexLagBlocks(ethSafe.blockNumber, sync.cursor.lastProcessedBlock),
      reorgDetected: sync.reorgDetected,
      upserted: sync.upserted,
      refreshed: refreshed.updated,
    },
    base: {
      cursorBlock: destination?.cursor.lastProcessedBlock.toString() ?? "0",
      cursorHash: destination?.cursor.lastProcessedBlockHash ?? "0x",
      safeBlock: baseSafe?.blockNumber.toString() ?? "0",
      lagBlocks: baseSafe
        ? indexLagBlocks(baseSafe.blockNumber, destination?.cursor.lastProcessedBlock ?? 0n)
        : "0",
      reorgDetected: Boolean(destination?.reorgDetected),
      updated: destination?.updated ?? 0,
    },
    staleMarked,
    enqueued,
    monitoredWallets,
  };
  writeMetrics(input.metricsPath ?? resolve(process.cwd(), ".data/monitoring-metrics.json"), metrics);
  return { metrics, transitions };
}

export async function openMonitorInfra(config: AppConfig): Promise<{
  models: PersistenceModels | null;
  queue: Queue<ImpactSimulationJob> | null;
  redis: Redis | null;
}> {
  if (!config.MONGODB_URI || !config.REDIS_URL) {
    return { models: null, queue: null, redis: null };
  }
  const connection = await connectMongo(config.MONGODB_URI, config.MONGODB_DB_NAME);
  await ensureMongoIndexes(connection);
  const models = createPersistenceModels(connection);
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<ImpactSimulationJob>(IMPACT_SIMULATION_QUEUE, { connection: redis });
  return { models, queue, redis };
}

export function defaultGovernanceStore(): GovernanceStore {
  return new JsonFileGovernanceStore(resolve(process.cwd(), ".data/governance-store.json"));
}

export type { NormalizedIndexedChange };
