import { Module } from "@nestjs/common";
import { createForkClients } from "@fork/blockchain";
import { loadConfig, type AppConfig } from "@fork/config";
import { APP_CONFIG } from "./config.token.js";
import { CHAIN_CLIENTS } from "./chain-clients.token.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
    {
      provide: CHAIN_CLIENTS,
      useFactory: (config: AppConfig) => createForkClients(config),
      inject: [APP_CONFIG],
    },
  ],
})
export class AppModule {}
