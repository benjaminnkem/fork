import type { Address, BlockAnchor, ProtocolChange, ProtocolPosition, RiskState } from "@fork/shared";

export interface ExposureResult {
  relevant: boolean;
  severityHint: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  matchedMarkets: Address[];
  matchedAssets: Address[];
  rationaleCodes: string[];
}

export interface ProtocolAdapter {
  readonly protocolId: string;
  getUserPositions(wallet: Address, anchor?: BlockAnchor): Promise<ProtocolPosition[]>;
  getRiskState(wallet: Address, anchor: BlockAnchor): Promise<RiskState>;
  listRelevantChanges(): Promise<ProtocolChange[]>;
  matchExposure(positions: ProtocolPosition[], change: ProtocolChange): Promise<ExposureResult>;
}

export function assertAdapterContract(adapter: ProtocolAdapter): string {
  return adapter.protocolId;
}
