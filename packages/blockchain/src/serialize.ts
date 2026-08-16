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

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) continue;
      out[key] = sortJsonValue(entry);
    }
    return out;
  }
  return value;
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(toJsonSafe(value)));
}
