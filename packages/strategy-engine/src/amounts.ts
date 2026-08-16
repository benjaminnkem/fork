import { ForkError } from "@fork/shared";

export function minBound(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  return values.reduce((lowest, value) => (value < lowest ? value : lowest));
}

export function assertPositiveAmount(amount: bigint, bound: bigint): void {
  if (amount <= 0n) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Strategy amount must be positive");
  }
  if (amount > bound) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Strategy amount exceeds feasible bound");
  }
}

export function parsePolicyMax(raw: string | undefined): bigint | undefined {
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Policy max amount is not a decimal integer");
  }
  return BigInt(raw);
}
