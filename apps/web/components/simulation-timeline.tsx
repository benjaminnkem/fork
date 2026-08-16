import { StatusBadge } from "@/components/status-badge";
import type { SimulationEvent } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

const STEPS = [
  "SIMULATION_QUEUED",
  "FORK_STARTING",
  "FORK_READY",
  "BASELINE_CAPTURED",
  "CHANGE_REPLAY_STARTED",
  "CHANGE_REPLAY_COMPLETED",
  "RISK_MEASURED",
  "AGENT_STARTED",
  "STRATEGY_OPTIMIZATION_STARTED",
  "STRATEGY_BRANCH_RESULT",
  "RECOMMENDATION_READY",
  "PROOF_READY",
  "FAILED",
  "CANCELLED",
];

export function SimulationTimeline({ events }: { events: SimulationEvent[] }) {
  const seen = new Set(events.map((event) => event.type));
  return (
    <ol className="grid gap-2">
      {STEPS.filter((step) => step !== "FAILED" && step !== "CANCELLED").map((step) => {
        const event = [...events].reverse().find((item) => item.type === step);
        const arrived = seen.has(step);
        return (
          <li
            key={step}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            data-complete={arrived ? "true" : "false"}
          >
            <span className="font-mono text-sm">{step}</span>
            {event ? (
              <span className="text-xs text-muted-foreground">{formatTimestamp(event.at)}</span>
            ) : (
              <StatusBadge value="pending" kind="plain" />
            )}
          </li>
        );
      })}
      {events
        .filter((event) => event.type === "FAILED" || event.type === "CANCELLED")
        .map((event) => (
          <li key={event.id} className="rounded-lg border border-destructive px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge value={event.type} kind="run" />
              <span className="text-xs text-muted-foreground">{formatTimestamp(event.at)}</span>
            </div>
          </li>
        ))}
    </ol>
  );
}
