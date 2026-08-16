import { Body, Controller, Get, Inject, Param, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { createUserRiskPolicy } from "@fork/risk-engine";
import type { PersistenceModels } from "@fork/persistence";
import { parseWithZod } from "../http.js";
import { AuthService } from "../auth/auth.service.js";
import { parseCookies, SESSION_COOKIE } from "../auth/session.js";
import { PERSISTENCE } from "../persistence.token.js";
import { APP_CONFIG } from "../config.token.js";
import type { AppConfig } from "@fork/config";
import { ForkError } from "@fork/shared";

const policyBody = z.object({
  minSafetyBufferBps: z.number().int().nonnegative().optional(),
  allowRepayDebt: z.boolean().optional(),
  allowAddCollateral: z.boolean().optional(),
  optimizationGoal: z.enum(["MIN_CAPITAL", "MAX_SAFETY", "MIN_TX_COUNT"]).optional(),
});

const monitoringBody = z.object({
  enabled: z.boolean(),
});

@Controller()
export class PolicyController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PERSISTENCE) private readonly models: PersistenceModels | null,
  ) {}

  @Get("wallets/:address/policy")
  async get(@Param("address") address: string) {
    if (!isAddress(address)) {
      throw new ForkError("INVALID_CONFIG", "Wallet must be a 20-byte hex address");
    }
    const wallet = getAddress(address);
    if (!this.models) {
      return { wallet, policy: createUserRiskPolicy({ envMinSafetyBufferBps: this.config.DEFAULT_MIN_SAFETY_BUFFER_BPS }), persisted: false };
    }
    const doc = (await this.models.walletRiskPolicies
      .findOne({ wallet: wallet.toLowerCase(), active: true })
      .lean()) as Record<string, unknown> | null;
    if (!doc) {
      return {
        wallet,
        persisted: false,
        policy: createUserRiskPolicy({ envMinSafetyBufferBps: this.config.DEFAULT_MIN_SAFETY_BUFFER_BPS }),
      };
    }
    return { wallet, persisted: true, policy: doc };
  }

  @Put("wallets/:address/policy")
  async put(@Param("address") address: string, @Body() body: unknown, @Req() request: Request) {
    if (!this.models) {
      throw new ForkError("INVALID_CONFIG", "MongoDB is required to persist wallet policy");
    }
    const session = this.auth.readSession(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
    const wallet = this.auth.assertOwns(session, address);
    const input = parseWithZod(policyBody, body ?? {});
    const current = (await this.models.walletRiskPolicies
      .findOne({ wallet: wallet.toLowerCase(), active: true })
      .sort({ version: -1 })
      .lean()) as { version?: number } | null;
    const version = (current?.version ?? 0) + 1;
    const policy = createUserRiskPolicy({
      minSafetyBufferBps: input.minSafetyBufferBps,
      envMinSafetyBufferBps: this.config.DEFAULT_MIN_SAFETY_BUFFER_BPS,
      allowRepayDebt: input.allowRepayDebt,
      allowAddCollateral: input.allowAddCollateral,
      optimizationGoal: input.optimizationGoal,
    });
    await this.models.walletRiskPolicies.updateMany(
      { wallet: wallet.toLowerCase(), active: true },
      { $set: { active: false } },
    );
    await this.models.walletRiskPolicies.create({
      ...policy,
      wallet: wallet.toLowerCase(),
      version,
      active: true,
    });
    return { wallet, persisted: true, policy, version };
  }

  @Get("wallets/:address/monitoring")
  async getMonitoring(@Param("address") address: string) {
    if (!isAddress(address)) {
      throw new ForkError("INVALID_CONFIG", "Wallet must be a 20-byte hex address");
    }
    const wallet = getAddress(address);
    if (!this.models) {
      return { wallet, monitoringEnabled: false, persisted: false };
    }
    const doc = (await this.models.wallets
      .findOne({ address: wallet.toLowerCase(), chainId: 8453 })
      .lean()) as { monitoringEnabled?: boolean } | null;
    return {
      wallet,
      monitoringEnabled: Boolean(doc?.monitoringEnabled),
      persisted: Boolean(doc),
    };
  }

  @Put("wallets/:address/monitoring")
  async putMonitoring(
    @Param("address") address: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    if (!this.models) {
      throw new ForkError("INVALID_CONFIG", "MongoDB is required to persist monitoring");
    }
    const session = this.auth.readSession(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
    const wallet = this.auth.assertOwns(session, address);
    const input = parseWithZod(monitoringBody, body);
    await this.models.wallets.updateOne(
      { address: wallet.toLowerCase(), chainId: 8453 },
      {
        $set: { monitoringEnabled: input.enabled, address: wallet.toLowerCase(), chainId: 8453 },
      },
      { upsert: true },
    );
    return { wallet, monitoringEnabled: input.enabled, persisted: true };
  }
}
