import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadConfig, loadRootEnv } from "@fork/config";
import { createLogger } from "@fork/observability";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  loadRootEnv();
  const config = loadConfig();
  const logger = createLogger({ name: "api", service: "api", level: config.LOG_LEVEL });
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.enableCors({ origin: config.WEB_ORIGIN });
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/live", "health/ready"],
  });
  await app.listen(config.API_PORT);
  logger.info({ port: config.API_PORT }, "api skeleton listening");
}

void bootstrap();
