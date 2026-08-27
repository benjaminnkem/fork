import { StatusBadge } from "@/components/status-badge";
import { InlineLoading } from "@/components/loading-state";
import type { SimulationEvent } from "@/lib/api";
import { formatTimeAgo, formatTimestamp } from "@/lib/format";

const LABELS: Record<string, string> = {
  SIMULATION_QUEUED: "Queued",
  FORK_STARTING: "Starting fork",
  FORK_READY: "Fork ready",
  BASELINE_CAPTURED: "Baseline captured",
  CHANGE_REPLAY_STARTED: "Replaying change",
  CHANGE_REPLAY_COMPLETED: "Change applied",
  RISK_MEASURED: "Risk measured",
  AGENT_STARTED: "Agent started",
  AGENT_OBSERVATION: "Agent observation",
  AGENT_TOOL_CALL: "Agent tool call",
  AGENT_TOOL_RESULT: "Agent tool result",
  AGENT_TOOL_REJECTED: "Agent tool rejected",
  AGENT_STRATEGY_VERIFIED: "Strategy verified",
  AGENT_STRATEGY_REJECTED: "Strategy rejected",
  AGENT_DECISION_SUMMARY: "Agent summary",
  AGENT_FINAL_SELECTION: "Final selection",
  AGENT_MODEL_FALLBACK: "Model fallback",
  AGENT_FAILED: "Agent failed",
  STRATEGY_OPTIMIZATION_STARTED: "Searching rescues",
  STRATEGY_BRANCH_RESULT: "Strategy result",
  RECOMMENDATION_READY: "Recommendation ready",
  PROOF_READY: "Proof ready",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function SimulationTimeline({
  events,
  running = false,
}: {
  events: SimulationEvent[];
  running?: boolean;
}) {
  const visible = events.filter((event) => event.type !== "FAILED" && event.type !== "CANCELLED");
  const failed = events.filter((event) => event.type === "FAILED" || event.type === "CANCELLED");

  if (visible.length === 0 && !running && failed.length === 0) {
    return <InlineLoading label="Waiting for the first event" />;
  }

  return (
    <ol className="grid gap-2">
      {visible.map((event) => (
        <li key={event.id} className="grid gap-1 rounded-lg bg-secondary/50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">{LABELS[event.type] ?? event.type}</span>
            <span className="text-xs text-muted-foreground" title={formatTimestamp(event.at)}>
              {formatTimeAgo(event.at)}
            </span>
          </div>
          {typeof event.data?.summary === "string" ? (
            <p className="text-xs leading-5 text-muted-foreground">{event.data.summary}</p>
          ) : null}
        </li>
      ))}
      {running ? (
        <li className="rounded-lg border border-dashed border-border px-3 py-2">
          <InlineLoading label="Working…" />
        </li>
      ) : null}
      {failed.map((event) => (
        <li
          key={event.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 px-3 py-2"
        >
          <StatusBadge value={event.type} kind="run" />
          <span className="text-xs text-muted-foreground">{formatTimeAgo(event.at)}</span>
        </li>
      ))}
    </ol>
  );
}
