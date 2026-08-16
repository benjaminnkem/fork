import {
  appendRunEvent,
  createEvent,
  findOpenRunsByChange,
  type PersistenceModels,
} from "@fork/persistence";
import { shouldCancelOpenSimulations } from "@fork/governance-core";

export async function markOpenRunsForChange(
  models: PersistenceModels,
  changeId: string,
  nextStatus: string,
): Promise<number> {
  const open = await findOpenRunsByChange(models, changeId);
  const cancel = shouldCancelOpenSimulations(nextStatus);
  const status = cancel ? "CANCELLED" : "STALE";
  const type = cancel ? "CANCELLED" : "FAILED";
  let marked = 0;
  for (const run of open) {
    await appendRunEvent(
      models,
      run.id,
      createEvent(type, { reason: "SOURCE_TRUTH_CHANGED", changeStatus: nextStatus }),
      {
        status,
        errorCode: cancel ? "CHANGE_CANCELLED" : "SIMULATION_STALE",
        completedAt: new Date(),
      },
    );
    marked += 1;
  }
  return marked;
}
