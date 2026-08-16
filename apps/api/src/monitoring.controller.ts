import { Controller, Get, Inject, Optional } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Queue } from "bullmq";
import { IMPACT_QUEUE } from "./persistence.token.js";
import { IMPACT_SIMULATION_QUEUE, type ImpactSimulationJob } from "@fork/shared";

@Controller()
export class MonitoringController {
  constructor(
    @Optional() @Inject(IMPACT_QUEUE) private readonly queue: Queue<ImpactSimulationJob> | null = null,
  ) {}

  @Get("monitoring")
  async monitoring() {
    let snapshot: Record<string, unknown> | null = null;
    try {
      snapshot = JSON.parse(
        readFileSync(resolve(process.cwd(), ".data/monitoring-metrics.json"), "utf8"),
      ) as Record<string, unknown>;
    } catch {
      snapshot = null;
    }
    let waiting = 0;
    let oldestAgeMs: number | null = null;
    if (this.queue) {
      const jobs = await this.queue.getJobs(["waiting", "delayed", "active"]);
      waiting = jobs.length;
      const now = Date.now();
      for (const job of jobs) {
        const ts = job.timestamp ?? 0;
        if (!ts) continue;
        const age = now - ts;
        if (oldestAgeMs === null || age > oldestAgeMs) oldestAgeMs = age;
      }
    }
    return {
      queue: {
        name: IMPACT_SIMULATION_QUEUE,
        waiting,
        oldestAgeMs,
      },
      indexer: snapshot ?? null,
    };
  }
}
