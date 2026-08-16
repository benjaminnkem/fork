import { loadConfig, loadRootEnv } from "@fork/config";
import { createLogger } from "@fork/observability";

loadRootEnv();
const config = loadConfig();
const logger = createLogger({ name: "simulator", service: "simulator", level: config.LOG_LEVEL });

if (config.ANVIL_HOST !== "127.0.0.1" && config.APP_ENV === "production") {
  throw new Error("Anvil must bind privately; refusing a non-localhost host in production");
}

logger.info(
  {
    anvilHost: config.ANVIL_HOST,
    maxParallelForks: config.MAX_PARALLEL_FORKS,
  },
  "simulator process online; use pnpm fork:replay moonwell-176 for the Anvil replay path",
);

function shutdown(signal: string) {
  logger.info({ signal }, "simulator shutting down");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
