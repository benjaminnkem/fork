import { Controller, Get, Inject, Optional } from "@nestjs/common";
import { checkChainReadiness, type ForkClients } from "@fork/blockchain";
import type { AppConfig } from "@fork/config";
import type { PersistenceModels } from "@fork/persistence";
import type { Redis } from "ioredis";
import { APP_CONFIG } from "../config.token.js";
import { CHAIN_CLIENTS } from "../chain-clients.token.js";
import { PERSISTENCE } from "../persistence.token.js";

export const REDIS = Symbol("REDIS");

@Controller()
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CHAIN_CLIENTS) private readonly clients: ForkClients,
    @Optional() @Inject(PERSISTENCE) private readonly models: PersistenceModels | null = null,
    @Optional() @Inject(REDIS) private readonly redis: Redis | null = null,
  ) {}

  @Get("health")
  health() {
    return this.live();
  }

  @Get("health/live")
  live() {
    return {
      status: "ok",
      service: "api",
      version: this.config.APP_VERSION,
    };
  }

  @Get("health/ready")
  async ready() {
    const baseRpc = this.clients.base
      ? await checkChainReadiness(this.clients.base)
      : undefined;
    const ethereumRpc = this.clients.ethereum
      ? await checkChainReadiness(this.clients.ethereum)
      : undefined;

    const rpcDown = Boolean(
      (baseRpc && !baseRpc.ok) || (ethereumRpc && !ethereumRpc.ok),
    );
    const rpcReady = Boolean(baseRpc?.ok && ethereumRpc?.ok);
    let mongodb = this.config.MONGODB_URI ? "configured" : "not_configured";
    if (this.models) {
      try {
        await this.models.wallets.estimatedDocumentCount();
        mongodb = "ok";
      } catch {
        mongodb = "down";
      }
    }
    let redis = this.config.REDIS_URL ? "configured" : "not_configured";
    if (this.redis) {
      try {
        redis = (await this.redis.ping()) === "PONG" ? "ok" : "down";
      } catch {
        redis = "down";
      }
    }
    const infraDown = mongodb === "down" || redis === "down";
    return {
      status: rpcDown || infraDown ? "fail" : rpcReady && mongodb === "ok" && redis === "ok" ? "ok" : "degraded",
      service: "api",
      checks: {
        config: "ok",
        mongodb,
        redis,
        baseRpc: baseRpc ? (baseRpc.ok ? `ok:${baseRpc.chainId}` : "down") : "not_configured",
        ethereumRpc: ethereumRpc
          ? ethereumRpc.ok
            ? `ok:${ethereumRpc.chainId}`
            : "down"
          : "not_configured",
        groq: this.config.GROQ_API_KEY ? "configured" : "not_configured",
      },
    };
  }
}
