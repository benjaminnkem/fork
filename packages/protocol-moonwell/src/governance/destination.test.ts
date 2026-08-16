import { describe, expect, it } from "vitest";
import { destinationStatusFromFactor } from "./destination.js";

describe("destinationStatusFromFactor", () => {
  it("marks destination executed only when the live factor matches the target", () => {
    expect(
      destinationStatusFromFactor({
        sourceStatus: "EXECUTED",
        currentFactor: 52n * 10n ** 16n,
        targetFactor: 52n * 10n ** 16n,
      }),
    ).toBe("EXECUTED");
    expect(
      destinationStatusFromFactor({
        sourceStatus: "EXECUTED",
        currentFactor: 68n * 10n ** 16n,
        targetFactor: 52n * 10n ** 16n,
      }),
    ).toBe("DESTINATION_PENDING");
    expect(
      destinationStatusFromFactor({
        sourceStatus: "CANCELLED",
        currentFactor: 52n * 10n ** 16n,
        targetFactor: 52n * 10n ** 16n,
      }),
    ).toBe("CANCELLED");
  });
});
