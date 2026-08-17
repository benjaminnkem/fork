import { format, formatDistanceToNow, fromUnixTime, isValid } from "date-fns";

export function formatTokenRaw(raw: string, decimals: number, maxFrac = 6): string {
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  if (!/^\d+$/.test(digits)) return raw;
  const value = BigInt(digits);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = value % scale;
  if (frac === 0n) return `${negative ? "-" : ""}${whole.toString()}`;
  const padded = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const trimmed = padded.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed
    ? `${negative ? "-" : ""}${whole.toString()}.${trimmed}`
    : `${negative ? "-" : ""}${whole.toString()}`;
}

export function shortenHex(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 2) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function decimalMetadata(metadata: Record<string, unknown>): number {
  const decimals = asNumber(metadata.underlyingDecimals);
  return decimals === undefined ? 18 : decimals;
}

export function parseTime(value: string | Date | number | undefined): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = value > 1e12 ? new Date(value) : fromUnixTime(value);
    return isValid(date) ? date : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return parseTime(Number(value));
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return isValid(date) ? date : null;
  }
  return null;
}

export function formatTimestamp(value: string | Date | number | undefined): string {
  const date = parseTime(value);
  if (!date) return "—";
  return format(date, "MMM d, yyyy · HH:mm");
}

export function formatTimeAgo(value: string | Date | number | undefined): string {
  const date = parseTime(value);
  if (!date) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function explorerTx(chainId: number, hash: string): string | undefined {
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  if (chainId === 1) return `https://etherscan.io/tx/${hash}`;
  return undefined;
}

export function explorerAddress(chainId: number, address: string): string | undefined {
  if (chainId === 8453) return `https://basescan.org/address/${address}`;
  if (chainId === 1) return `https://etherscan.io/address/${address}`;
  return undefined;
}

export function explorerBlock(chainId: number, block: string): string | undefined {
  if (chainId === 8453) return `https://basescan.org/block/${block}`;
  if (chainId === 1) return `https://etherscan.io/block/${block}`;
  return undefined;
}
