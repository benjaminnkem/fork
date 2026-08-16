import { Controller, Get, Inject } from "@nestjs/common";
import { checkChainReadiness, type ForkClients } from "@fork/blockchain";
import type { AppConfig } from "@fork/config";
import { APP_CONFIG } from "../config.token.js";
import { CHAIN_CLIENTS } from "../chain-clients.token.js";

@Controller()
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CHAIN_CLIENTS) private readonly clients: ForkClients,
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

    return {
      status: rpcDown ? "fail" : rpcReady ? "degraded" : "degraded",
      service: "api",
      checks: {
        config: "ok",
        mongodb: this.config.MONGODB_URI ? "configured" : "not_configured",
        redis: this.config.REDIS_URL ? "configured" : "not_configured",
        baseRpc: baseRpc ? (baseRpc.ok ? `ok:${baseRpc.chainId}` : "down") : "not_configured",
        ethereumRpc: ethereumRpc
          ? ethereumRpc.ok
            ? `ok:${ethereumRpc.chainId}`
            : "down"
          : "not_configured",
        groq: this.config.GROQ_API_KEY ? "configured" : "not_configured",
      },
      note: rpcReady
        ? "RPC reads are live. Mongo, Redis, and Groq are not required until later phases."
        : "Configure BASE_RPC_URL and ETHEREUM_RPC_URL for live chain readiness.",
    };
  }
}
