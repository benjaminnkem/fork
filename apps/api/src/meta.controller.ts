import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import type { PersistenceModels } from "@fork/persistence";
import { Inject } from "@nestjs/common";
import { PERSISTENCE } from "./persistence.token.js";

@Controller()
export class MetaController {
  constructor(@Inject(PERSISTENCE) private readonly models: PersistenceModels | null) {}

  @Get("protocols")
  protocols() {
    return {
      protocols: [
        {
          id: "moonwell",
          chainId: 8453,
          name: "Moonwell Core",
          adapter: "protocol-moonwell",
        },
      ],
    };
  }

  @Get("agent-runs/:id/trace")
  async agentTrace(@Param("id") id: string) {
    if (!this.models) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Agent traces require MongoDB" });
    }
    const run = await this.models.agentRuns.findById(id).lean();
    if (!run) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Agent run not found" });
    }
    const events = await this.models.agentTraceEvents
      .find({ runId: id })
      .sort({ sequence: 1 })
      .lean();
    return { run, events };
  }
}
