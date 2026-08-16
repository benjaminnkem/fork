export const QUEUE_NAMES = [
  "governance-sync",
  "wallet-refresh",
  "impact-simulation",
  "strategy-simulation",
  "agent-analysis",
  "post-execution-verify",
  "maintenance",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export const IMPACT_SIMULATION_QUEUE = "impact-simulation" satisfies QueueName;
export const STRATEGY_SIMULATION_QUEUE = "strategy-simulation" satisfies QueueName;
export const AGENT_ANALYSIS_QUEUE = "agent-analysis" satisfies QueueName;
export const GOVERNANCE_SYNC_QUEUE = "governance-sync" satisfies QueueName;

export interface ImpactSimulationJob {
  simulationRunId: string;
  wallet: string;
  changeId: string;
  scenario: string;
  includeStrategies: boolean;
}
