import { afterAll, describe, expect, it } from "vitest";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadConfig, loadRootEnv } from "@fork/config";
import {
  connectMongo,
  createPersistenceModels,
  disconnectMongo,
  ensureMongoIndexes,
} from "@fork/persistence";
import { PINNED_ADD_COLLATERAL_WALLET } from "@fork/protocol-moonwell";
import { IMPACT_SIMULATION_QUEUE } from "@fork/shared";
import { processImpactSimulation } from "../../../simulator/src/process-impact.js";
import { AppModule } from "../app.module.js";

loadRootEnv();
const config = loadConfig();
const live = Boolean(
  config.MONGODB_URI &&
    config.REDIS_URL &&
    config.BASE_RPC_URL &&
    config.ETHEREUM_RPC_URL &&
    process.env.RUN_API_E2E === "1",
);

describe.skipIf(!live)("api simulation e2e", () => {
  let app: INestApplication | undefined;
  let worker: Worker | undefined;
  let redis: Redis | undefined;

  afterAll(async () => {
    await worker?.close();
    await redis?.quit();
    await app?.close();
  });

  it(
    "queues a real impact simulation and streams completion",
    { timeout: 300_000 },
    async () => {
      const connection = await connectMongo(config.MONGODB_URI!, config.MONGODB_DB_NAME);
      await ensureMongoIndexes(connection);
      const models = createPersistenceModels(connection);
      redis = new Redis(config.REDIS_URL!, { maxRetriesPerRequest: null });
      worker = new Worker(
        IMPACT_SIMULATION_QUEUE,
        async (job) => processImpactSimulation(models, config, job.data),
        { connection: redis, concurrency: 1 },
      );
      worker.on("failed", (_job, error) => {
        console.error("worker-failed", error.message);
      });
      await worker.waitUntilReady();

      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix("api/v1", { exclude: ["health", "health/live", "health/ready"] });
      await app.init();
      await app.listen(0);
      const port = (app.getHttpServer() as { address: () => { port: number } }).address().port;

      const created = await fetch(`http://127.0.0.1:${port}/api/v1/simulations/impact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: PINNED_ADD_COLLATERAL_WALLET,
          scenario: "moonwell-176",
        }),
      });
      expect([200, 201]).toContain(created.status);
      const run = (await created.json()) as { id: string; status: string };
      expect(run.id).toBeTruthy();
      expect(["QUEUED", "RUNNING", "COMPLETED"]).toContain(run.status);

      let latest: { status: string; receiptHash?: string } | undefined;
      const deadline = Date.now() + 240_000;
      while (Date.now() < deadline) {
        const final = await fetch(`http://127.0.0.1:${port}/api/v1/simulations/${run.id}`);
        latest = (await final.json()) as { status: string; receiptHash?: string };
        if (latest.status === "COMPLETED" || latest.status === "FAILED") break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      expect(latest).toBeTruthy();
      expect(["COMPLETED", "FAILED"]).toContain(latest!.status);

      const stream = await fetch(`http://127.0.0.1:${port}/api/v1/simulations/${run.id}/stream`);
      expect(stream.status).toBe(200);
      expect(stream.headers.get("content-type")).toContain("text/event-stream");
      const body = await stream.text();
      expect(body).toContain("SIMULATION_QUEUED");
      expect(body.includes("PROOF_READY") || body.includes("FAILED")).toBe(true);

      if (latest!.status === "COMPLETED") {
        const proof = await fetch(`http://127.0.0.1:${port}/api/v1/simulations/${run.id}/proof`);
        expect(proof.status).toBe(200);
      }

      await disconnectMongo(connection);
    },
  );
});
