import { parseAbi } from "viem";

export const moonwellMultichainGovernorAbi = parseAbi([
  "function proposalCount() view returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function getProposalData(uint256 proposalId) view returns (address[] targets, uint256[] values, bytes[] calldatas)",
  "function proposalVotes(uint256 proposalId) view returns (uint256, uint256, uint256)",
  "function liveProposals() view returns (uint256[])",
  "function votingPeriod() view returns (uint256)",
  "function crossChainVoteCollectionPeriod() view returns (uint256)",
  "function quorum() view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
]);

export const wormholePublishMessageAbi = parseAbi([
  "function publishMessage(uint32 nonce, bytes payload, uint8 consistencyLevel)",
]);

export const moonwellTemporalGovernorAbi = parseAbi([
  "function proposalDelay() view returns (uint256)",
  "function owner() view returns (address)",
]);

export const moonwellSetCollateralFactorAbi = parseAbi([
  "function _setCollateralFactor(address mToken, uint256 newCollateralFactorMantissa)",
]);

export const ETHEREUM_WORMHOLE_CORE = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B" as const;

export const SET_COLLATERAL_FACTOR_SELECTOR = "0xe4028eee" as const;
export const PUBLISH_MESSAGE_SELECTOR = "0xb19a437e" as const;
