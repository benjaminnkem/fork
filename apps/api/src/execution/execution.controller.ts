import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { parseWithZod } from "../http.js";
import { AuthService } from "../auth/auth.service.js";
import { parseCookies, SESSION_COOKIE } from "../auth/session.js";
import { ExecutionService } from "./execution.service.js";

const prepareBody = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  simulationId: z.string().min(1),
  strategyType: z.enum(["REPAY_DEBT", "ADD_COLLATERAL"]),
});

const registerBody = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  callIndex: z.number().int().nonnegative(),
});

@Controller()
export class ExecutionController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ExecutionService) private readonly execution: ExecutionService,
  ) {}

  private sessionOf(request: Request) {
    return this.auth.readSession(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
  }

  @Post("execution/prepare")
  prepare(@Body() body: unknown, @Req() request: Request) {
    const input = parseWithZod(prepareBody, body);
    const session = this.sessionOf(request);
    const wallet = this.auth.assertOwns(session, input.wallet);
    return this.execution.prepare({
      wallet,
      simulationId: input.simulationId,
      strategyType: input.strategyType,
    });
  }

  @Post("execution/:planId/register-tx")
  register(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const input = parseWithZod(registerBody, body);
    const session = this.sessionOf(request);
    return this.execution.registerTx({
      id: planId,
      wallet: session.address,
      txHash: input.txHash as `0x${string}`,
      callIndex: input.callIndex,
    });
  }

  @Get("execution/:planId")
  get(@Param("planId") planId: string, @Req() request: Request) {
    const session = this.sessionOf(request);
    return this.execution.get(planId, session.address);
  }
}
