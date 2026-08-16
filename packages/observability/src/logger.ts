import pino from "pino";

export function createLogger(options?: {
  name?: string;
  level?: string;
  service?: string;
}) {
  return pino({
    name: options?.name ?? "fork",
    level: options?.level ?? process.env.LOG_LEVEL ?? "info",
    base: {
      service: options?.service ?? options?.name ?? "fork",
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "headers.authorization",
        "*.apiKey",
        "*.privateKey",
        "GROQ_API_KEY",
        "SESSION_SECRET",
        "MONGODB_URI",
        "REDIS_URL",
      ],
      remove: true,
    },
  });
}
