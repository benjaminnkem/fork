export interface CollectionIndexSpec {
  collection: string;
  name: string;
  keys: Record<string, 1 | -1>;
  unique?: boolean;
  expireAfterSeconds?: number;
}

export const COLLECTION_INDEXES: CollectionIndexSpec[] = [
  {
    collection: "wallets",
    name: "wallets_chain_address_unique",
    keys: { chainId: 1, address: 1 },
    unique: true,
  },
  {
    collection: "walletRiskPolicies",
    name: "wallet_risk_policies_wallet_version_unique",
    keys: { wallet: 1, policyVersion: 1, version: 1 },
    unique: true,
  },
  {
    collection: "walletRiskPolicies",
    name: "wallet_risk_policies_active",
    keys: { wallet: 1, active: 1 },
  },
  {
    collection: "positionSnapshots",
    name: "position_snapshots_wallet_block",
    keys: { wallet: 1, "anchor.blockNumber": -1 },
  },
  {
    collection: "governanceRawEvents",
    name: "governance_raw_events_log_unique",
    keys: { chainId: 1, txHash: 1, logIndex: 1 },
    unique: true,
  },
  {
    collection: "protocolChanges",
    name: "protocol_changes_id_unique",
    keys: { id: 1 },
    unique: true,
  },
  {
    collection: "protocolChanges",
    name: "protocol_changes_status_execution",
    keys: { protocol: 1, status: 1, earliestExecutionAt: 1 },
  },
  {
    collection: "protocolChanges",
    name: "protocol_changes_markets_status",
    keys: { affectedMarkets: 1, status: 1 },
  },
  {
    collection: "protocolChanges",
    name: "protocol_changes_assets_status",
    keys: { affectedAssets: 1, status: 1 },
  },
  {
    collection: "exposures",
    name: "exposures_wallet_change_unique",
    keys: { wallet: 1, protocolChangeId: 1 },
    unique: true,
  },
  {
    collection: "exposures",
    name: "exposures_relevant_severity",
    keys: { relevant: 1, severityHint: 1 },
  },
  {
    collection: "simulationRuns",
    name: "simulation_runs_idempotency_unique",
    keys: { idempotencyKey: 1 },
    unique: true,
  },
  {
    collection: "simulationRuns",
    name: "simulation_runs_wallet_change_created",
    keys: { wallet: 1, protocolChangeId: 1, createdAt: -1 },
  },
  {
    collection: "simulationRuns",
    name: "simulation_runs_status_created",
    keys: { status: 1, createdAt: 1 },
  },
  {
    collection: "simulationBranches",
    name: "simulation_branches_run_created",
    keys: { runId: 1, createdAt: -1 },
  },
  {
    collection: "evidence",
    name: "evidence_ref_lookup",
    keys: { chainId: 1, type: 1, txHash: 1, address: 1 },
  },
  {
    collection: "receipts",
    name: "receipts_hash_unique",
    keys: { receiptHash: 1 },
    unique: true,
  },
  {
    collection: "receipts",
    name: "receipts_wallet_change",
    keys: { wallet: 1, protocolChangeId: 1, createdAt: -1 },
  },
  {
    collection: "agentRuns",
    name: "agent_runs_simulation",
    keys: { simulationRunId: 1, createdAt: -1 },
  },
  {
    collection: "agentTraceEvents",
    name: "agent_trace_run_sequence",
    keys: { runId: 1, sequence: 1 },
    unique: true,
  },
  {
    collection: "executionAttempts",
    name: "execution_attempts_wallet_plan",
    keys: { wallet: 1, planHash: 1, createdAt: -1 },
  },
  {
    collection: "authNonces",
    name: "auth_nonces_nonce_unique",
    keys: { nonce: 1 },
    unique: true,
  },
  {
    collection: "authNonces",
    name: "auth_nonces_ttl",
    keys: { expiresAt: 1 },
    expireAfterSeconds: 0,
  },
];
