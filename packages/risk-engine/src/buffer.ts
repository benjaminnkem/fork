const MAX_BUFFER_BPS = 1_000_000;

export function computeSafetyBufferBps(
  liquidityRaw: bigint,
  borrowValueRaw: bigint,
): number | undefined {
  if (borrowValueRaw <= 0n) return undefined;
  if (liquidityRaw <= 0n) return 0;
  const raw = (liquidityRaw * 10000n) / borrowValueRaw;
  if (raw > BigInt(MAX_BUFFER_BPS)) return MAX_BUFFER_BPS;
  return Number(raw);
}
