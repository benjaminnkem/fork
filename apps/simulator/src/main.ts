import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadConfig, loadRootEnv } from "@fork/config";
import { createLogger } from "@fork/observability";
import {
  connectMongo,
  createPersistenceModels,
  disconnectMongo,
  ensureMongoIndexes,
} from "@fork/persistence";
import { ForkError, IMPACT_SIMULATION_QUEUE, type ImpactSimulationJob } from "@fork/shared";
import { processImpactSimulation } from "./process-impact.js";

loadRootEnv();
const config = loadConfig();
const logger = createLogger({ name: "simulator", service: "simulator", level: config.LOG_LEVEL });

if (config.ANVIL_HOST !== "127.0.0.1" && config.APP_ENV === "production") {
  throw new Error("Anvil must bind privately; refusing a non-localhost host in production");
}
if (!config.REDIS_URL) {
  throw new ForkError("INVALID_CONFIG", "REDIS_URL is required for the simulator worker");
}
if (!config.MONGODB_URI) {
  throw new ForkError("INVALID_CONFIG", "MONGODB_URI is required for the simulator worker");
}

const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const connection = await connectMongo(config.MONGODB_URI, config.MONGODB_DB_NAME);
await ensureMongoIndexes(connection);
const models = createPersistenceModels(connection);

const worker = new Worker<ImpactSimulationJob>(
  IMPACT_SIMULATION_QUEUE,
  async (job) => {
    logger.info({ jobId: job.id, runId: job.data.simulationRunId }, "impact job started");
    await processImpactSimulation(models, config, job.data);
  },
  {
    connection: redis,
    concurrency: config.MAX_PARALLEL_FORKS,
  },
);

const inspect = new Queue(IMPACT_SIMULATION_QUEUE, { connection: redis });

worker.on("failed", (job, error) => {
  logger.error(
    { jobId: job?.id, err: error.message },
    "impact job failed",
  );
});

logger.info(
  {
    anvilHost: config.ANVIL_HOST,
    maxParallelForks: config.MAX_PARALLEL_FORKS,
  },
  "simulator worker listening for impact-simulation jobs",
);

async function shutdown(signal: string) {
  logger.info({ signal }, "simulator shutting down");
  await worker.close();
  await inspect.close();
  await redis.quit();
  await disconnectMongo(connection);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
