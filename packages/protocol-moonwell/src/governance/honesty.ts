import type { SimulationReceipt } from "@fork/simulation-core";

export function describeReplayHonesty(receipt: SimulationReceipt): {
  createdShortfall: boolean;
  classification: string;
  liquidityDeltaRaw: string;
  shortfallDeltaRaw: string;
  beforeStatus: string;
  afterStatus: string;
  summary: string;
} {
  const createdShortfall =
    receipt.before.risk.status !== "SHORTFALL" && receipt.after.risk.status === "SHORTFALL";
  const summary = createdShortfall
    ? "Replay created a Comptroller shortfall."
    : `Replay did not create insolvency. Measured class is ${receipt.materialRisk.classification}.`;
  return {
    createdShortfall,
    classification: receipt.materialRisk.classification,
    liquidityDeltaRaw: receipt.liquidityDeltaRaw,
    shortfallDeltaRaw: receipt.materialRisk.shortfallDeltaRaw,
    beforeStatus: receipt.before.risk.status,
    afterStatus: receipt.after.risk.status,
    summary,
  };
}
