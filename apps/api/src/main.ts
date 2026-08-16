import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadConfig, loadRootEnv } from "@fork/config";
import { createLogger } from "@fork/observability";
import { AppModule } from "./app.module.js";
import { ForkExceptionFilter, JsonSafeInterceptor } from "./http.js";

async function bootstrap() {
  loadRootEnv();
  const config = loadConfig();
  const logger = createLogger({ name: "api", service: "api", level: config.LOG_LEVEL });
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.enableShutdownHooks();
  app.useGlobalFilters(new ForkExceptionFilter());
  app.useGlobalInterceptors(new JsonSafeInterceptor());
  app.enableCors({
    origin: config.WEB_ORIGIN,
    credentials: true,
    exposedHeaders: ["Last-Event-ID"],
  });
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/live", "health/ready"],
  });
  await app.listen(config.API_PORT);
  logger.info({ port: config.API_PORT }, "api listening");
}

void bootstrap();
