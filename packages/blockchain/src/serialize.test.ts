import { describe, expect, it } from "vitest";
import { canonicalizeJson, parseBigint, serializeBigint, toJsonSafe } from "./serialize.js";

describe("bigint serialization", () => {
  it("round-trips decimal strings and never uses floating point", () => {
    const value = 123456789012345678901234567890n;
    expect(serializeBigint(value)).toBe("123456789012345678901234567890");
    expect(parseBigint(serializeBigint(value))).toBe(value);
  });

  it("rejects non-decimal input", () => {
    expect(() => parseBigint("1.5")).toThrow(/Invalid decimal bigint/);
    expect(() => parseBigint("0x10")).toThrow(/Invalid decimal bigint/);
  });

  it("encodes nested bigints as decimal strings", () => {
    expect(toJsonSafe({ blockNumber: 42n, nested: [1n] })).toEqual({
      blockNumber: "42",
      nested: ["1"],
    });
  });

  it("canonicalizes object key order", () => {
    expect(canonicalizeJson({ b: 1n, a: { d: 2n, c: 3n } })).toBe(
      canonicalizeJson({ a: { c: 3n, d: 2n }, b: 1n }),
    );
    expect(canonicalizeJson({ b: 1n, a: 2n })).toBe('{"a":"2","b":"1"}');
  });
});
