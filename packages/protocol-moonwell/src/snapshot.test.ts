import { describe, expect, it } from "vitest";
import { hasOpenPosition, underlyingFromSnapshot } from "./snapshot.js";

describe("underlyingFromSnapshot", () => {
  it("uses integer Compound scaling", () => {
    expect(underlyingFromSnapshot(100n, 10n ** 18n)).toBe(100n);
    expect(underlyingFromSnapshot(2n, 5n * 10n ** 18n)).toBe(10n);
    expect(underlyingFromSnapshot(3n, 10n ** 18n + 1n)).toBe(3n);
  });

  it("treats zero supply and borrow as no position", () => {
    expect(hasOpenPosition(0n, 0n)).toBe(false);
    expect(hasOpenPosition(1n, 0n)).toBe(true);
  });
});
