import { getRequiredContract } from "@fork/abis";
import { combineChangeStatus, mapMultichainGovernorState } from "@fork/governance-core";
import type { NormalizedIndexedChange } from "@fork/governance-core";
import {
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  PROTOCOL_MOONWELL,
  type Address,
  type EvidenceRef,
  type ProtocolChange,
  type ProtocolChangeType,
} from "@fork/shared";
import { classifySelector, decodeSetCollateralFactor, type DecodedGovernorProposal } from "./decode.js";

const BASE_TEMPORAL_GOVERNOR = getRequiredContract(BASE_CHAIN_ID, "temporalGovernor").address.toLowerCase();
const BASE_COMPTROLLER = getRequiredContract(BASE_CHAIN_ID, "comptroller").address.toLowerCase();

export const PINNED_BASE_CF_PROPOSAL_ID = "176";

function changeTypeFromCalls(proposal: DecodedGovernorProposal): ProtocolChangeType {
  const destTypes = proposal.destinationBatches
    .filter((batch) => batch.temporalGovernor.toLowerCase() === BASE_TEMPORAL_GOVERNOR)
    .flatMap((batch) => batch.calls)
    .map((call) => classifySelector(call.selector));
  if (destTypes.includes("COLLATERAL_FACTOR_CHANGE")) {
    return "COLLATERAL_FACTOR_CHANGE";
  }
  return "UNKNOWN";
}

function baseDestinationCalls(proposal: DecodedGovernorProposal) {
  return proposal.destinationBatches
    .filter((batch) => batch.temporalGovernor.toLowerCase() === BASE_TEMPORAL_GOVERNOR)
    .flatMap((batch) => batch.calls);
}

export function collectAffectedMarkets(proposal: DecodedGovernorProposal): Address[] {
  const markets = new Set<string>();
  for (const call of baseDestinationCalls(proposal)) {
    if (classifySelector(call.selector) !== "COLLATERAL_FACTOR_CHANGE") continue;
    if (call.target.toLowerCase() !== BASE_COMPTROLLER) continue;
    try {
      markets.add(decodeSetCollateralFactor(call.calldata).market);
    } catch {
      continue;
    }
  }
  return [...markets] as Address[];
}

export function normalizeGovernorProposal(input: {
  proposal: DecodedGovernorProposal;
  rawGovernorState: number;
  votes: readonly [bigint, bigint, bigint];
  discoveredAt: Date;
  evidence: EvidenceRef[];
  affectedAssets?: Address[];
}): NormalizedIndexedChange {
  const sourceStatus = mapMultichainGovernorState(input.rawGovernorState);
  const destCalls = baseDestinationCalls(input.proposal);
  const destinationStatus =
    sourceStatus === "EXECUTED" && destCalls.length > 0 ? "DESTINATION_PENDING" : "UNKNOWN";
  const type = changeTypeFromCalls(input.proposal);
  const affectedMarkets = collectAffectedMarkets(input.proposal);
  const supportLevel =
    type === "COLLATERAL_FACTOR_CHANGE" && destCalls.length > 0
      ? "DESTINATION_EFFECT_REPLAY"
      : destCalls.length > 0
        ? "ANALYSIS_ONLY"
        : "UNSUPPORTED";

  const change: ProtocolChange = {
    id: `moonwell:eth:${input.proposal.proposalId}`,
    protocol: PROTOCOL_MOONWELL,
    sourceChainId: ETHEREUM_CHAIN_ID,
    destinationChainId: BASE_CHAIN_ID,
    status: combineChangeStatus(sourceStatus, destinationStatus, destCalls.length > 0),
    type,
    proposalId: input.proposal.proposalId,
    sourceTxHashes: [],
    targetCalls: destCalls.length > 0 ? destCalls : input.proposal.sourceCalls,
    affectedMarkets,
    affectedAssets: input.affectedAssets ?? [],
    discoveredAt: input.discoveredAt,
    updatedAt: input.discoveredAt,
    evidence: input.evidence,
    supportLevel,
  };

  return {
    change,
    sourceStatus,
    destinationStatus,
    rawGovernorState: input.rawGovernorState,
    forVotesRaw: input.votes[0].toString(),
    againstVotesRaw: input.votes[1].toString(),
    abstainVotesRaw: input.votes[2].toString(),
  };
}
