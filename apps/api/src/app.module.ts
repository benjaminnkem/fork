import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { createForkClients } from "@fork/blockchain";
import { loadConfig, type AppConfig } from "@fork/config";
import {
  connectMongo,
  createPersistenceModels,
  ensureMongoIndexes,
  type PersistenceModels,
} from "@fork/persistence";
import { IMPACT_SIMULATION_QUEUE } from "@fork/shared";
import { APP_CONFIG } from "./config.token.js";
import { CHAIN_CLIENTS } from "./chain-clients.token.js";
import { HealthController, REDIS } from "./health/health.controller.js";
import { IMPACT_QUEUE, PERSISTENCE, RATE_LIMITER } from "./persistence.token.js";
import { MemoryRateLimiter } from "./http.js";
import { SimulationsService } from "./simulations/simulations.service.js";
import { SimulationsController } from "./simulations/simulations.controller.js";
import { WalletsController } from "./wallets/wallets.controller.js";
import { ChangesController } from "./changes/changes.controller.js";
import { MetaController } from "./meta.controller.js";

@Module({
  controllers: [
    HealthController,
    SimulationsController,
    WalletsController,
    ChangesController,
    MetaController,
  ],
  providers: [
    SimulationsService,
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
    {
      provide: CHAIN_CLIENTS,
      useFactory: (config: AppConfig) => createForkClients(config),
      inject: [APP_CONFIG],
    },
    {
      provide: PERSISTENCE,
      useFactory: async (config: AppConfig): Promise<PersistenceModels | null> => {
        if (!config.MONGODB_URI) return null;
        const connection = await connectMongo(config.MONGODB_URI, config.MONGODB_DB_NAME);
        await ensureMongoIndexes(connection);
        return createPersistenceModels(connection);
      },
      inject: [APP_CONFIG],
    },
    {
      provide: REDIS,
      useFactory: (config: AppConfig): Redis | null => {
        if (!config.REDIS_URL) return null;
        return new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
      },
      inject: [APP_CONFIG],
    },
    {
      provide: IMPACT_QUEUE,
      useFactory: (redis: Redis | null) => {
        if (!redis) return null;
        return new Queue(IMPACT_SIMULATION_QUEUE, { connection: redis });
      },
      inject: [REDIS],
    },
    {
      provide: RATE_LIMITER,
      useFactory: (config: AppConfig) =>
        new MemoryRateLimiter(
          config.PUBLIC_RATE_LIMIT_TTL_SECONDS * 1000,
          config.PUBLIC_RATE_LIMIT_MAX,
        ),
      inject: [APP_CONFIG],
    },
  ],
})
export class AppModule {}
