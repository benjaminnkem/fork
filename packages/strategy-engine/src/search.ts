export interface BinarySearchInput {
  lo: bigint;
  hi: bigint;
  maxProbes: number;
  test: (amount: bigint) => Promise<boolean>;
}

export interface BinarySearchOutput {
  amount: bigint | null;
  probes: bigint[];
  complete: boolean;
}

export async function findMinimumPassingAmount(
  input: BinarySearchInput,
): Promise<BinarySearchOutput> {
  const probes: bigint[] = [];
  if (input.hi < input.lo || input.maxProbes <= 0) {
    return { amount: null, probes, complete: true };
  }

  let low = input.lo;
  let high = input.hi;
  let found: bigint | null = null;

  while (low <= high) {
    if (probes.length >= input.maxProbes) {
      return { amount: found, probes, complete: false };
    }
    const mid = low + (high - low) / 2n;
    probes.push(mid);
    const passed = await input.test(mid);
    if (passed) {
      found = mid;
      high = mid - 1n;
    } else {
      low = mid + 1n;
    }
  }

  return { amount: found, probes, complete: true };
}
