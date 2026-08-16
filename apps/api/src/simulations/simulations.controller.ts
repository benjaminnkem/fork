import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { PINNED_REPLAY_WALLET } from "@fork/protocol-moonwell";
import { clientKey, MemoryRateLimiter, parseWithZod } from "../http.js";
import { RATE_LIMITER } from "../persistence.token.js";
import { SimulationsService } from "./simulations.service.js";

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const impactBody = z.object({
  wallet: addressSchema,
  changeId: z.string().min(1).optional(),
  scenario: z.string().min(1).optional(),
  includeStrategies: z.boolean().optional(),
});

const historicalBody = z.object({
  wallet: addressSchema.optional(),
  includeStrategies: z.boolean().optional(),
});

@Controller()
export class SimulationsController {
  constructor(
    @Inject(SimulationsService) private readonly simulations: SimulationsService,
    @Inject(RATE_LIMITER) private readonly limiter: MemoryRateLimiter,
  ) {}

  @Post("simulations/impact")
  async createImpact(@Body() body: unknown, @Req() request: Request) {
    this.limiter.consume(`impact:${clientKey(request)}`);
    const input = parseWithZod(impactBody, body);
    return this.simulations.createImpact(input);
  }

  @Get("simulations/:id")
  getSimulation(@Param("id") id: string) {
    return this.simulations.getRun(id);
  }

  @Get("simulations/:id/proof")
  getProof(@Param("id") id: string) {
    return this.simulations.getProof(id);
  }

  @Get("simulations/:id/strategies")
  getStrategies(@Param("id") id: string) {
    return this.simulations.getStrategies(id);
  }

  @Get("simulations/:id/stream")
  async stream(
    @Param("id") id: string,
    @Headers("last-event-id") lastEventId: string | undefined,
    @Res() response: Response,
  ) {
    const run = await this.simulations.getRun(id);
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();

    let cursor = lastEventId ?? "";
    const write = (eventId: string, type: string, data: unknown) => {
      response.write(`id: ${eventId}\n`);
      response.write(`event: ${type}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const replay = (current: typeof run) => {
      const start = cursor
        ? current.events.findIndex((event) => event.id === cursor) + 1
        : 0;
      for (const event of current.events.slice(Math.max(0, start))) {
        write(event.id, event.type, {
          type: event.type,
          at: event.at,
          data: event.data ?? {},
          status: current.status,
        });
        cursor = event.id;
      }
    };

    replay(run);
    if (run.status === "COMPLETED" || run.status === "FAILED") {
      response.end();
      return;
    }

    const timer = setInterval(() => {
      void this.simulations
        .getRun(id)
        .then((latest) => {
          replay(latest);
          if (latest.status === "COMPLETED" || latest.status === "FAILED") {
            clearInterval(timer);
            response.end();
          }
        })
        .catch(() => {
          clearInterval(timer);
          response.end();
        });
    }, 750);

    response.on("close", () => {
      clearInterval(timer);
    });
  }

  @Get("historical-replays")
  listHistorical() {
    return this.simulations.historicalReplays();
  }

  @Post("historical-replays/:slug/run")
  async runHistorical(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    this.limiter.consume(`historical:${clientKey(request)}`);
    if (slug !== "moonwell-176") {
      throw new NotFoundException({
        code: "UNSUPPORTED_PROTOCOL_CHANGE",
        message: "Unknown historical replay slug",
      });
    }
    const input = parseWithZod(historicalBody, body ?? {});
    return this.simulations.createImpact({
      wallet: input.wallet ?? PINNED_REPLAY_WALLET,
      scenario: slug,
      includeStrategies: input.includeStrategies,
    });
  }
}
