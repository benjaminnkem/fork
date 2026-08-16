const EXCHANGE_RATE_SCALE = 10n ** 18n;

export function underlyingFromSnapshot(mTokenBalance: bigint, exchangeRateRaw: bigint): bigint {
  return (mTokenBalance * exchangeRateRaw) / EXCHANGE_RATE_SCALE;
}

export function hasOpenPosition(suppliedRaw: bigint, borrowedRaw: bigint): boolean {
  return suppliedRaw > 0n || borrowedRaw > 0n;
}
