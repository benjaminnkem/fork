import { z } from "zod";
import { ForkError } from "@fork/shared";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
  APP_VERSION: z.string().default("dev"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  SESSION_SECRET: z.string().optional(),
  AUTH_NONCE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  PUBLIC_RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().default("fork"),
  REDIS_URL: z.string().optional(),

  BASE_CHAIN_ID: z.coerce.number().int().default(8453),
  BASE_RPC_URL: optionalUrl,
  BASE_FALLBACK_RPC_URL: z.string().default("https://mainnet.base.org"),
  ETHEREUM_CHAIN_ID: z.coerce.number().int().default(1),
  ETHEREUM_RPC_URL: optionalUrl,
  ETHEREUM_FALLBACK_RPC_URL: optionalUrl,

  MOONWELL_REGISTRY_VERSION: z.string().default("moonwell-core-2026-08-16"),
  MOONWELL_ALLOW_REGISTRY_OVERRIDE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  GOVERNANCE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  GOVERNANCE_LOG_BLOCK_RANGE: z.coerce.number().int().positive().default(5000),

  ANVIL_BINARY: z.string().default("anvil"),
  ANVIL_HOST: z.string().default("127.0.0.1"),
  ANVIL_PORT_START: z.coerce.number().int().positive().default(9500),
  MAX_PARALLEL_FORKS: z.coerce.number().int().positive().default(2),
  SIMULATION_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  FORK_START_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  SIMULATION_RECEIPT_SCHEMA_VERSION: z.string().default("1"),

  GROQ_API_KEY: z.string().optional(),
  GROQ_PLANNER_MODEL: z.string().default("openai/gpt-oss-120b"),
  GROQ_FALLBACK_MODEL: z.string().default("openai/gpt-oss-20b"),
  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(10),
  AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  AGENT_REASONING_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  AGENT_MAX_COMPLETION_TOKENS: z.coerce.number().int().positive().default(2048),
  AGENT_MAX_INVALID_CALLS: z.coerce.number().int().positive().default(3),
  AGENT_INCLUDE_REASONING: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  DEFAULT_MIN_SAFETY_BUFFER_BPS: z.coerce.number().int().nonnegative().optional(),
  SIMULATION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),

  ENABLE_MAINNET_TRANSACTION_PREPARATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ENABLE_AUTONOMOUS_MAINNET_EXECUTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  NEXT_PUBLIC_API_URL: z.string().optional(),
  NEXT_PUBLIC_BASE_CHAIN_ID: z.coerce.number().int().default(8453),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(raw: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ForkError("INVALID_CONFIG", "Environment validation failed", {
      details: { issues: parsed.error.issues },
    });
  }

  const config = parsed.data;
  const productionLike = config.NODE_ENV === "production" || config.APP_ENV === "production";

  if (productionLike) {
    const missing: string[] = [];
    if (!config.SESSION_SECRET) missing.push("SESSION_SECRET");
    if (!config.MONGODB_URI) missing.push("MONGODB_URI");
    if (!config.REDIS_URL) missing.push("REDIS_URL");
    if (!config.BASE_RPC_URL) missing.push("BASE_RPC_URL");
    if (!config.ETHEREUM_RPC_URL) missing.push("ETHEREUM_RPC_URL");
    if (config.ENABLE_AUTONOMOUS_MAINNET_EXECUTION) {
      throw new ForkError(
        "INVALID_CONFIG",
        "ENABLE_AUTONOMOUS_MAINNET_EXECUTION must remain false in V1",
      );
    }
    if (missing.length > 0) {
      throw new ForkError(
        "INVALID_CONFIG",
        `Production startup refused missing required env: ${missing.join(", ")}`,
        { details: { missing } },
      );
    }
  }

  if (config.BASE_CHAIN_ID !== 8453) {
    throw new ForkError("INVALID_CONFIG", "V1 only supports Base Mainnet chain ID 8453");
  }
  if (config.ETHEREUM_CHAIN_ID !== 1) {
    throw new ForkError("INVALID_CONFIG", "V1 governance source must be Ethereum Mainnet chain ID 1");
  }

  return config;
}
