export function serializeBigint(value: bigint): string {
  return value.toString(10);
}

export function parseBigint(value: string): bigint {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Invalid decimal bigint: ${value}`);
  }
  return BigInt(value);
}

export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") {
    return serializeBigint(value);
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = toJsonSafe(entry);
    }
    return out;
  }
  return value;
}
