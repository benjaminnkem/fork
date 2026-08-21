import { Queue } from "bullmq";
import { getAddress } from "viem";
import type { PersistenceModels } from "@fork/persistence";
import {
  claimSimulationRun,
  createEvent,
  isDuplicateJobError,
  requeueSimulationRun,
} from "@fork/persistence";
import {
  PINNED_BASE_CF_PROPOSAL_ID,
  PINNED_REPLAY_FORK_BLOCK,
  PINNED_REPLAY_FORK_HASH,
} from "@fork/protocol-moonwell";
import { createUserRiskPolicy } from "@fork/risk-engine";
import { impactSimulationJobId, simulationIdempotencyKey } from "@fork/simulation-core";
import {
  IMPACT_QUEUE_MAX_INFLIGHT,
  IMPACT_SIMULATION_QUEUE,
  type Address,
  type ImpactSimulationJob,
} from "@fork/shared";

const REQUEUE_STATUSES = new Set(["FAILED", "STALE", "CANCELLED"]);

export async function enqueuePinnedImpact(input: {
  models: PersistenceModels;
  queue: Queue<ImpactSimulationJob>;
  wallet: string;
  changeId: string;
  engineVersion: string;
}): Promise<"created" | "existing" | "skipped"> {
  const wallet = getAddress(input.wallet) as Address;
  const changeId = input.changeId;
  if (changeId !== `moonwell:eth:${PINNED_BASE_CF_PROPOSAL_ID}`) return "skipped";
  const policy = createUserRiskPolicy();
  const idempotencyKey = simulationIdempotencyKey({
    wallet,
    changeId,
    forkBlockHash: PINNED_REPLAY_FORK_HASH,
    policyVersion: policy.policyVersion,
    engineVersion: input.engineVersion,
  });
  let run = await claimSimulationRun(input.models, {
    wallet,
    protocolChangeId: changeId,
    mode: "impact",
    status: "QUEUED",
    replayGrade: "DESTINATION_EFFECT_REPLAY",
    idempotencyKey,
    engineVersion: input.engineVersion,
    policyVersion: policy.policyVersion,
    forkBlockNumber: PINNED_REPLAY_FORK_BLOCK.toString(),
    forkBlockHash: PINNED_REPLAY_FORK_HASH,
    scenario: "moonwell-176",
    includeStrategies: true,
    events: [createEvent("SIMULATION_QUEUED")],
  });
  if (REQUEUE_STATUSES.has(run.status)) {
    run =
      (await requeueSimulationRun(input.models, run.id, { includeStrategies: true })) ?? run;
  }
  if (run.status === "COMPLETED") return "existing";
  const counts = await input.queue.getJobCounts("waiting", "delayed", "active");
  const inflight = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
  if (inflight >= IMPACT_QUEUE_MAX_INFLIGHT) {
    return "skipped";
  }
  const jobId = impactSimulationJobId(run.idempotencyKey);
  const existingJob = await input.queue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      return "existing";
    }
    await existingJob.remove();
  }
  try {
    await input.queue.add(
      IMPACT_SIMULATION_QUEUE,
      {
        simulationRunId: run.id,
        wallet,
        changeId,
        scenario: "moonwell-176",
        includeStrategies: true,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  } catch (error) {
    if (isDuplicateJobError(error)) return "existing";
    throw error;
  }
  return "created";
}
