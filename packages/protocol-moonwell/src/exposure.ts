import type { ExposureResult, ProtocolChange, ProtocolPosition } from "@fork/shared";
import { getAddress } from "viem";

function asAddress(value: string) {
  return getAddress(value);
}

export function matchMoonwellExposure(
  positions: ProtocolPosition[],
  change: ProtocolChange,
): ExposureResult {
  const affectedMarkets = new Set(change.affectedMarkets.map((item) => asAddress(item)));
  const affectedAssets = new Set(change.affectedAssets.map((item) => asAddress(item)));
  const matched = positions.filter((position) => {
    return (
      affectedMarkets.has(asAddress(position.market)) ||
      affectedAssets.has(asAddress(position.underlying))
    );
  });

  const evidence = [
    ...matched.map((position) => ({
      type: "CONTRACT_CALL" as const,
      chainId: position.chainId,
      blockNumber: position.anchor.blockNumber.toString(),
      blockHash: position.anchor.blockHash,
      address: position.market,
      method: "getAccountSnapshot",
    })),
    ...change.evidence,
  ];

  const matchedMarkets = [...new Set(matched.map((position) => asAddress(position.market)))];
  const matchedAssets = [...new Set(matched.map((position) => asAddress(position.underlying)))];

  if (matched.length === 0) {
    return {
      relevant: false,
      severityHint: "NONE",
      matchedMarkets: [],
      matchedAssets: [],
      rationaleCodes: positions.length === 0 ? ["NO_POSITIONS"] : ["NO_MARKET_OR_ASSET_OVERLAP"],
      evidence,
    };
  }

  if (change.type === "COLLATERAL_FACTOR_CHANGE") {
    const collateralSupply = matched.filter(
      (position) => position.collateralEnabled && position.suppliedRaw > 0n,
    );
    if (collateralSupply.length > 0) {
      return {
        relevant: true,
        severityHint: "HIGH",
        matchedMarkets: [...new Set(collateralSupply.map((position) => asAddress(position.market)))],
        matchedAssets: [
          ...new Set(collateralSupply.map((position) => asAddress(position.underlying))),
        ],
        rationaleCodes: ["MARKET_MATCH", "COLLATERAL_ENABLED", "SUPPLY_EXPOSURE"],
        evidence,
      };
    }
    return {
      relevant: false,
      severityHint: "NONE",
      matchedMarkets,
      matchedAssets,
      rationaleCodes: ["MARKET_MATCH", "CF_REQUIRES_COLLATERAL_SUPPLY"],
      evidence,
    };
  }

  return {
    relevant: true,
    severityHint: "MEDIUM",
    matchedMarkets,
    matchedAssets,
    rationaleCodes: ["MARKET_MATCH", "UNSUPPORTED_CHANGE_TYPE"],
    evidence,
  };
}
